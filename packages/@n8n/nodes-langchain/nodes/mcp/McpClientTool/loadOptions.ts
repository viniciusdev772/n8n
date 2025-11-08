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

export async function getAllToolsWithParameters(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	try {
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

		// Verify endpoint is configured
		if (!endpointUrl) {
			return [
				{
					name: '⚠️ Configure endpoint first',
					value: '',
					description: 'Please configure the MCP server endpoint above',
				},
			];
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
			return [
				{
					name: '❌ Failed to connect to MCP server',
					value: '',
					description: 'Check your endpoint and authentication settings',
				},
			];
		}

		// Get all tools from MCP server
		const allTools = await getAllTools(client.result);

		// Respect "Tools to Include" configuration
		const mode = this.getNodeParameter('include', 0, 'all') as 'all' | 'selected' | 'except';
		const includeTools = this.getNodeParameter('includeTools', 0, []) as string[];
		const excludeTools = this.getNodeParameter('excludeTools', 0, []) as string[];

		// Filter tools based on user selection
		let filteredTools = allTools;
		switch (mode) {
			case 'selected':
				if (includeTools.length > 0) {
					const includeSet = new Set(includeTools);
					filteredTools = allTools.filter((tool) => includeSet.has(tool.name));
				}
				break;
			case 'except':
				const excludeSet = new Set(excludeTools);
				filteredTools = allTools.filter((tool) => !excludeSet.has(tool.name));
				break;
			case 'all':
			default:
				filteredTools = allTools;
				break;
		}

		const allParameters: INodePropertyOptions[] = [];

		// Extract parameters only from filtered tools
		filteredTools.forEach((tool) => {
			const schema = tool.inputSchema;

			if (schema && schema.type === 'object' && schema.properties) {
				Object.entries(schema.properties).forEach(([paramName, paramSchema]) => {
					const description =
						typeof paramSchema === 'object' && paramSchema !== null && 'description' in paramSchema
							? (paramSchema.description as string)
							: '';
					const isRequired = Array.isArray(schema.required) && schema.required.includes(paramName);

					// Format: "toolName.paramName"
					allParameters.push({
						name: `${tool.name} → ${paramName}${isRequired ? ' ⭐' : ''}`,
						value: `${tool.name}.${paramName}`,
						description: description || `Parameter ${paramName} of tool ${tool.name}`,
					});
				});
			}
		});

		return allParameters;
	} catch (error) {
		return [];
	}
}
