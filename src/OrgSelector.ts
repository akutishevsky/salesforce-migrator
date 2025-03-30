import * as vscode from "vscode";

export class OrgSelector implements vscode.WebviewViewProvider {
    private extensionContext: vscode.ExtensionContext;

    constructor(extensionContext: vscode.ExtensionContext) {
        this.extensionContext = extensionContext;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): Thenable<void> | void {}
}
