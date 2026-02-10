import { ChildProcess } from "node:child_process";
import spawn from "cross-spawn";
import * as vscode from "vscode";

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
        args: string[],
        token?: vscode.CancellationToken,
    ): Promise<any> {
        const argsWithJsonFlag = this._addJsonFlag(args);
        let childProcess: ChildProcess | null = null;

        try {
            childProcess = this._createChildProcess(command, argsWithJsonFlag);

            const { state, disposable } = this._setupCancellationHandling(
                childProcess,
                token,
            );

            const { stdout, stderr } = await this._executeChildProcess(
                childProcess,
                disposable,
                state,
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
    private _createChildProcess(command: string, args: string[]): ChildProcess {
        return spawn(command, args, {
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
        token?: vscode.CancellationToken,
    ): {
        state: { cancelled: boolean };
        disposable: vscode.Disposable | undefined;
    } {
        const state = { cancelled: false };
        const disposable = token?.onCancellationRequested(() => {
            if (childProcess?.pid) {
                state.cancelled = true;
                this._killChildProcess(childProcess);
            }
        });

        return { state, disposable };
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
        state: { cancelled: boolean },
    ): Promise<CommandOutput> {
        const MAX_BUFFER_SIZE = 100 * 1024 * 1024; // 100 MB
        return new Promise((resolve, reject) => {
            let stdout = "";
            let stderr = "";

            childProcess.stdout?.on("data", (data) => {
                stdout += data;
                if (stdout.length > MAX_BUFFER_SIZE) {
                    this._killChildProcess(childProcess);
                    reject(
                        new Error(
                            "Command output exceeded maximum buffer size (100 MB)",
                        ),
                    );
                }
            });

            childProcess.stderr?.on("data", (data) => {
                stderr += data;
                if (stderr.length > MAX_BUFFER_SIZE) {
                    this._killChildProcess(childProcess);
                    reject(
                        new Error(
                            "Command error output exceeded maximum buffer size (100 MB)",
                        ),
                    );
                }
            });

            childProcess.on("error", (error) => {
                this._killChildProcess(childProcess);
                reject(error);
            });

            childProcess.on("close", (code) => {
                // Clean up cancellation event listener
                disposable?.dispose();

                if (state.cancelled) {
                    reject(new Error("Operation cancelled"));
                    return;
                }

                if (stderr && !this._isSalesforceCLIUpdateWarning(stderr)) {
                    const sanitizedError = stderr.split("\n")[0].slice(0, 500);
                    reject(new Error(sanitizedError));
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
            return JSON.parse(error.stdout).result;
        }
    }

    /**
     * Safely kill a child process
     * @param childProcess The process to kill
     */
    private _killChildProcess(childProcess: ChildProcess | null): void {
        if (!childProcess?.pid) {
            return;
        }

        try {
            // Try to kill the process group to ensure all child processes are terminated
            process.kill(-childProcess.pid, "SIGTERM");
        } catch {
            // Process group kill can fail (e.g., process already exited); fall back to direct kill
            try {
                childProcess.kill("SIGTERM");
            } catch {
                // Process already exited; nothing left to clean up
            }
        }
    }

    /**
     * Adds the `--json` flag to a command if not already present
     * @param command The command to process
     * @returns {string} A new command string with the `--json` flag
     */
    private _addJsonFlag(args: string[]): string[] {
        return args.includes("--json") ? args : [...args, "--json"];
    }

    /**
     * Checks if a stderr message is just a Salesforce CLI update warning
     * @param message The stderr message to check
     * @returns True if the message is just an update warning
     */
    private _isSalesforceCLIUpdateWarning(message: string): boolean {
        return message.includes(
            "Warning: @salesforce/cli update available from",
        );
    }
}
