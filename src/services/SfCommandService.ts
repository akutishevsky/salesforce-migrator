import { exec } from "node:child_process";
import { promisify } from "util";
import * as vscode from "vscode";

const execPromise = promisify(exec);

/**
 * A service class that executes Salesforce CLI commands
 */
export class SfCommandService {
    private readonly _workspacePath: string;

    constructor() {
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspacePath) {
            throw new Error("No workspace folder found");
        }
        this._workspacePath = workspacePath;
    }

    /**
     * Executes a Salesforce CLI command with the `--json` flag enabled by default
     * @param command The command to execute
     * @param token Optional cancellation token
     * @returns {Promise} Parsed JSON result of the command execution
     */
    public async execute(
        command: string,
        token?: vscode.CancellationToken
    ): Promise<any> {
        const commandWithJsonFlag = this._addJsonFlag(command);

        // Use a more appropriate buffer size (100MB) instead of the excessive 1GB
        // This is sufficient for most Salesforce metadata operations while using significantly less memory
        const childProcess = exec(commandWithJsonFlag, {
            maxBuffer: 100 * 1024 * 1024, // 100MB buffer
            cwd: this._workspacePath,
        });

        // Setup cancellation if token is provided
        let cancelled = false;
        if (token) {
            token.onCancellationRequested(() => {
                if (childProcess.pid) {
                    cancelled = true;
                    process.kill(-childProcess.pid, "SIGTERM");
                }
            });
        }

        return new Promise((resolve, reject) => {
            let stdout = "";
            let stderr = "";

            childProcess.stdout?.on("data", (data) => {
                stdout += data;
            });

            childProcess.stderr?.on("data", (data) => {
                stderr += data;
            });

            childProcess.on("close", (code) => {
                if (cancelled) {
                    reject(new Error("Operation cancelled"));
                    return;
                }

                if (stderr && !this._isSalesforceCLIUpdateWarning(stderr)) {
                    reject(stderr);
                    return;
                }

                try {
                    resolve(JSON.parse(stdout).result);
                } catch (error: any) {
                    try {
                        resolve(JSON.parse(error.stdout).result);
                    } catch (parseError) {
                        reject(parseError);
                    }
                }
            });
        });
    }

    /**
     * Adds the `--json` flag to a command if not already present
     * @param command The command to process
     * @returns {string} A new command string with the `--json` flag
     */
    private _addJsonFlag(command: string): string {
        return command.includes("--json") ? command : `${command} --json`;
    }

    private _isSalesforceCLIUpdateWarning(message: string): boolean {
        return message.includes(
            "Warning: @salesforce/cli update available from"
        );
    }
}
