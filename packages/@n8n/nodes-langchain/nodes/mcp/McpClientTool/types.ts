import type { JSONSchema7 } from 'json-schema';
import type { IDataObject } from 'n8n-workflow';

export type McpTool = { name: string; description?: string; inputSchema: JSONSchema7 };

export type McpServerTransport = 'sse' | 'httpStreamable';

export type McpToolIncludeMode = 'all' | 'selected' | 'except';

export type McpAuthenticationOption = 'none' | 'headerAuth' | 'bearerAuth' | 'mcpOAuth2Api';

export type ParameterMode = 'static' | 'dynamic' | 'hybrid';

export type ToolParameterConfig = {
	toolName: string;
	parameters: {
		[paramName: string]: {
			mode: ParameterMode;
			staticValue?: unknown;
		};
	};
};

export type ToolParametersMap = {
	[toolName: string]: IDataObject;
};
