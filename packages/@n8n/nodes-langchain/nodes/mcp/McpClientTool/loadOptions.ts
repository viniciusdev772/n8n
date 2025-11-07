import {
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	NodeOperationError,
} from 'n8n-workflow';

import type { McpAuthenticationOption, McpServerTransport } from './types';
import { connectMcpClient, getAllTools, getAuthHeaders, tryRefreshOAuth2Token } from './utils';

export async function getTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const authentication = this.getNodeParameter('authentication') as McpAuthenticationOption;
	const node = this.getNode();
	let serverTransport: McpServerTransport;
	let endpointUrl: string;
	if (node.typeVersion === 1) {
		serverTransport = 'sse';
		endpointUrl = this.getNodeParameter('sseEndpoint') as string;
	} else {
		serverTransport = this.getNodeParameter('serverTransport') as McpServerTransport;
		endpointUrl = this.getNodeParameter('endpointUrl') as string;
	}
	const { headers } = await getAuthHeaders(this, authentication);
	const client = await connectMcpClient({
		serverTransport,
		endpointUrl,
		headers,
		name: node.type,
		version: node.typeVersion,
		onUnauthorized: async (headers) => await tryRefreshOAuth2Token(this, authentication, headers),
	});

	if (!client.ok) {
		throw new NodeOperationError(this.getNode(), 'Could not connect to your MCP server');
	}

	const tools = await getAllTools(client.result);
	return tools.map((tool) => ({
		name: tool.name,
		value: tool.name,
		description: tool.description,
	}));
}

export async function getToolParameters(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const authentication = this.getNodeParameter('authentication') as McpAuthenticationOption;
	const node = this.getNode();
	let serverTransport: McpServerTransport;
	let endpointUrl: string;
	if (node.typeVersion === 1) {
		serverTransport = 'sse';
		endpointUrl = this.getNodeParameter('sseEndpoint') as string;
	} else {
		serverTransport = this.getNodeParameter('serverTransport') as McpServerTransport;
		endpointUrl = this.getNodeParameter('endpointUrl') as string;
	}

	// Get the selected tool name from the current parameter being configured
	const toolName = this.getCurrentNodeParameter('toolName') as string;

	if (!toolName) {
		return [];
	}

	const { headers } = await getAuthHeaders(this, authentication);
	const client = await connectMcpClient({
		serverTransport,
		endpointUrl,
		headers,
		name: node.type,
		version: node.typeVersion,
		onUnauthorized: async (headers) => await tryRefreshOAuth2Token(this, authentication, headers),
	});

	if (!client.ok) {
		throw new NodeOperationError(this.getNode(), 'Could not connect to your MCP server');
	}

	const tools = await getAllTools(client.result);
	const selectedTool = tools.find((tool) => tool.name === toolName);

	if (!selectedTool || !selectedTool.inputSchema) {
		return [];
	}

	// Extract parameters from the inputSchema
	const parameters: INodePropertyOptions[] = [];
	const schema = selectedTool.inputSchema;

	if (schema.type === 'object' && schema.properties) {
		Object.entries(schema.properties).forEach(([paramName, paramSchema]) => {
			const description =
				typeof paramSchema === 'object' && paramSchema !== null && 'description' in paramSchema
					? (paramSchema.description as string)
					: '';
			const isRequired = Array.isArray(schema.required) && schema.required.includes(paramName);

			parameters.push({
				name: `${paramName}${isRequired ? ' (required)' : ''}`,
				value: paramName,
				description: description || `Parameter: ${paramName}`,
			});
		});
	}

	return parameters;
}
