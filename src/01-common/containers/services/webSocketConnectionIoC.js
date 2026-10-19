import WebSocketConnectionService from '../../../03-domain/services/webSocketConnectionService.js';

// Each group needs its own connection and lifecycle.
const createWebSocketConnectionService = options => new WebSocketConnectionService(options);

export { createWebSocketConnectionService };