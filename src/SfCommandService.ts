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
     * @returns {Promise} Parsed JSON result of the command execution
     */
    public async execute(command: string): Promise<any> {
        const commandWithJsonFlag = this._addJsonFlag(command);
        try {
            const { stdout, stderr } = await execPromise(commandWithJsonFlag, {
                maxBuffer: 1024 * 1024 * 1024, // 1GB buffer
                cwd: this._workspacePath,
            });

            if (stderr && !this._isSalesforceCLIUpdateWarning(stderr)) {
                throw stderr;
            }

            return JSON.parse(stdout).result;
        } catch (error: any) {
            return JSON.parse(error.stdout).result;
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
