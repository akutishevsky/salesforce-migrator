import { exec, ChildProcess } from "node:child_process";
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
        let childProcess: ChildProcess | null = null;

        try {
            childProcess = exec(commandWithJsonFlag, {
                maxBuffer: 100 * 1024 * 1024, // 100MB buffer
                cwd: this._workspacePath,
            });

            let cancelled = false;
            const disposable = token?.onCancellationRequested(() => {
                if (childProcess?.pid) {
                    cancelled = true;
                    this._killChildProcess(childProcess);
                }
            });

            const result = await new Promise((resolve, reject) => {
                let stdout = "";
                let stderr = "";

                childProcess?.stdout?.on("data", (data) => {
                    stdout += data;
                });

                childProcess?.stderr?.on("data", (data) => {
                    stderr += data;
                });

                childProcess?.on("error", (error) => {
                    this._killChildProcess(childProcess);
                    reject(error);
                });

                childProcess?.on("close", (code) => {
                    disposable?.dispose();

                    if (cancelled) {
                        reject(new Error("Operation cancelled"));
                        return;
                    }

                    if (stderr && !this._isSalesforceCLIUpdateWarning(stderr)) {
                        reject(new Error(stderr));
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

            return result;
        } catch (error) {
            if (childProcess) {
                this._killChildProcess(childProcess);
            }
            throw error;
        }
    }

    /**
     * Safely kill a child process
     * @param childProcess The process to kill
     */
    private _killChildProcess(childProcess: ChildProcess | null): void {
        if (!childProcess || !childProcess.pid) {
            return;
        }

        try {
            // Try to kill the process group to ensure all child processes are terminated
            process.kill(-childProcess.pid, "SIGTERM");
        } catch (error) {
            // If killing the process group fails, try to kill just the process
            try {
                childProcess.kill("SIGTERM");
            } catch (innerError) {
                console.error("Failed to kill child process:", innerError);
            }
        }
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
