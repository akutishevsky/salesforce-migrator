import * as vscode from "vscode";

/**
 * `HtmlService` is a utility class to compose HTML for webview panels in VSCode.
 */
export class HtmlService {
    private _webviewView?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;

    constructor({
        view,
        extensionUri,
    }: {
        view: vscode.WebviewView;
        extensionUri: vscode.Uri;
    }) {
        this._webviewView = view;
        this._extensionUri = extensionUri;
    }

    /**
     * Compose `HTML` code for the webview panel.
     * @param {Object} options - The options for composing HTML.
     * @param {string} options.body - The body content of the HTML.
     * @param {string} [options.title] - The title of the HTML document.
     * @param {string[]} [options.styles] - An array of stylesheets to include.
     * @param {string[]} [options.scripts] - An array of scripts to include.
     * @returns {string} The composed HTML string.
     */
    public composeHtml({
        body,
        title = "Salesforce Migrator",
        styles = [],
        scripts = [],
    }: {
        body: string;
        title?: string;
        styles?: string[];
        scripts?: string[];
    }): string {
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                ${this._composeStyles(styles)}
            </head>
                <body>
                    ${body}
                    ${this._composeScripts(scripts)}
                </body>
            </html>`;
        return html;
    }

    private _composeStyles(styles: string[]): string {
        let stylesHtml = "";

        for (const style of styles) {
            stylesHtml += `
                <link 
                    rel="stylesheet" 
                    href="
                        ${this._webviewView?.webview.asWebviewUri(
                            vscode.Uri.joinPath(this._extensionUri, style)
                        )}" 
                />`;
        }

        return stylesHtml;
    }

    private _composeScripts(scripts: string[]): string {
        let scriptsHtml = "";

        for (const script of scripts) {
            scriptsHtml += `
                <script 
                    src="
                        ${this._webviewView?.webview.asWebviewUri(
                            vscode.Uri.joinPath(this._extensionUri, script)
                        )}" 
                />`;
        }

        return scriptsHtml;
    }
}
