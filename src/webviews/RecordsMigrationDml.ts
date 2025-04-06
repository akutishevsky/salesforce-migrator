import * as vscode from "vscode";

export class RecordsMigrationDml {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _customObject: string;
    private _operation: string;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        customObject: string,
        operation: string
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._customObject = customObject;
        this._operation = operation;
    }

    public async reveal(): Promise<void> {}
}
