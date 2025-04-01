import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { ObjectService, CustomObject } from "../services/ObjectService";
import { OrgService } from "../services/OrgService";
import { SfCommandService } from "../services/SfCommandService";

export class RecordsSelectorView implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView | undefined;
    private _htmlService!: HtmlService;
    private _orgService: OrgService;
    private _sfCommandService: SfCommandService;
    private _objectService: ObjectService;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
        this._orgService = new OrgService(extensionContext);
        this._sfCommandService = new SfCommandService();
        this._objectService = new ObjectService();
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        this._webviewView = webviewView;
        this._htmlService = new HtmlService({
            view: this._webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri],
        };

        this._renderLoader();

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first."
            );
            return;
        }

        const customObjects: CustomObject[] =
            await this._objectService.getCustomObjects(sourceOrg);

        this._composeWebviewHtml(customObjects);
    }

    private _renderLoader(): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.getLoaderHtml();
    }

    private _composeWebviewHtml(customObjects: CustomObject[]): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeObjectsHtml(customObjects),
            styles: ["/resources/css/list.css"],
            scripts: ["/resources/js/list.js"],
        });
    }

    private _composeObjectsHtml(customObjects: CustomObject[]): string {
        customObjects.sort((a, b) => {
            return a.fullName.localeCompare(b.fullName);
        });

        let html = `
            <div>
                ${this._composeObjectFilterHtml()}
                ${this._composeObjectListHtml(customObjects)}
            </div>
        `;

        return html;
    }

    private _composeObjectFilterHtml(): string {
        return `
            <div class="filter-container">
                <input type="text" id="filter" placeholder="Filter Objects" />
            </div>
        `;
    }

    private _composeObjectListHtml(customObjects: CustomObject[]): string {
        let html = `<div class="list">`;
        for (const customObject of customObjects) {
            html += `<div class="list-item">${customObject.fullName}</div>`;
        }
        html += `</div>`;

        return html;
    }
}
