import * as vscode from "vscode";

export class RecordsMigrationDml {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _customObject: string;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        customObject: string
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._customObject = customObject;
    }

    public async reveal(): Promise<void> {}
}
