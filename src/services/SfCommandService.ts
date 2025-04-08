import { exec, ChildProcess } from "node:child_process";
import { promisify } from "util";
import * as vscode from "vscode";

const execPromise = promisify(exec);

/**
 * Interface representing the result of command execution
 */
interface CommandOutput {
    stdout: string;
    stderr: string;
}

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
            childProcess = this._createChildProcess(commandWithJsonFlag);

            const { cancelled, disposable } = this._setupCancellationHandling(
                childProcess,
                token
            );

            const { stdout, stderr } = await this._executeChildProcess(
                childProcess,
                disposable,
                cancelled
            );

            return this._parseCommandOutput(stdout, stderr);
        } catch (error) {
            // Ensure process is killed if any uncaught error occurs
            if (childProcess) {
                this._killChildProcess(childProcess);
            }
            throw error;
        }
    }

    /**
     * Creates a child process to execute the command
     * @param command The command to execute
     * @returns The created child process
     */
    private _createChildProcess(command: string): ChildProcess {
        return exec(command, {
            maxBuffer: 100 * 1024 * 1024, // 100MB buffer
            cwd: this._workspacePath,
        });
    }

    /**
     * Sets up cancellation handling for the child process
     * @param childProcess The child process to handle cancellation for
     * @param token Optional cancellation token
     * @returns Object containing cancelled flag and disposable
     */
    private _setupCancellationHandling(
        childProcess: ChildProcess,
        token?: vscode.CancellationToken
    ): { cancelled: boolean; disposable: vscode.Disposable | undefined } {
        let cancelled = false;
        const disposable = token?.onCancellationRequested(() => {
            if (childProcess?.pid) {
                cancelled = true;
                this._killChildProcess(childProcess);
            }
        });

        return { cancelled, disposable };
    }

    /**
     * Executes the child process and collects stdout and stderr
     * @param childProcess The child process to execute
     * @param disposable The disposable for cancellation
     * @param cancelled Flag indicating if the operation was cancelled
     * @returns Promise resolving to the command output
     */
    private _executeChildProcess(
        childProcess: ChildProcess,
        disposable: vscode.Disposable | undefined,
        cancelled: boolean
    ): Promise<CommandOutput> {
        return new Promise((resolve, reject) => {
            let stdout = "";
            let stderr = "";

            childProcess.stdout?.on("data", (data) => {
                stdout += data;
            });

            childProcess.stderr?.on("data", (data) => {
                stderr += data;
            });

            childProcess.on("error", (error) => {
                this._killChildProcess(childProcess);
                reject(error);
            });

            childProcess.on("close", (code) => {
                // Clean up cancellation event listener
                disposable?.dispose();

                if (cancelled) {
                    reject(new Error("Operation cancelled"));
                    return;
                }

                if (stderr && !this._isSalesforceCLIUpdateWarning(stderr)) {
                    reject(new Error(stderr));
                    return;
                }

                resolve({ stdout, stderr });
            });
        });
    }

    /**
     * Parses the command output to extract the JSON result
     * @param stdout Standard output from the command
     * @param stderr Standard error from the command
     * @returns Parsed JSON result
     */
    private _parseCommandOutput(stdout: string, stderr: string): any {
        try {
            return JSON.parse(stdout).result;
        } catch (error: any) {
            try {
                return JSON.parse(error.stdout).result;
            } catch (parseError) {
                throw parseError;
            }
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

    /**
     * Checks if a stderr message is just a Salesforce CLI update warning
     * @param message The stderr message to check
     * @returns True if the message is just an update warning
     */
    private _isSalesforceCLIUpdateWarning(message: string): boolean {
        return message.includes(
            "Warning: @salesforce/cli update available from"
        );
    }
}
