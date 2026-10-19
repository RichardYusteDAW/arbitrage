import { TIMING } from '../../config.js';

class WebSocketConnectionService {

    constructor({
        exchangeName,
        config,
        pairs,
        prepareConnection,
        WebSocketImpl = globalThis.WebSocket,
        reconnectDelay = TIMING.reconnectDelay,
        onTickers,
        onDisconnect,
        onState
    }) {
        this.exchangeName = exchangeName;
        this.config = config;
        this.pairs = pairs;
        this.prepareConnection = prepareConnection;
        this.WebSocketImpl = WebSocketImpl;
        this.reconnectDelay = reconnectDelay;
        this.onTickers = onTickers;
        this.onDisconnect = onDisconnect;
        this.onState = onState;
        this.connected = false;
        this.error = null;
        this.attempts = 0;
        this.stopped = false;
    }

    start(delay = 0) {
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    clearConnectionTimers() {
        clearTimeout(this.connectionTimer);
        clearTimeout(this.subscriptionTimer);
        clearInterval(this.watchdog);
        clearTimeout(this.pongTimer);
    }

    async connect() {
        if (this.stopped)
            return;

        const openedAt = Date.now();
        let socket;
        let failed = false;
        const isActive = () => !failed && !this.stopped && this.socket === socket;
        const fail = error => {

            if (failed || this.stopped)
                return;

            failed = true;
            this.clearConnectionTimers();
            this.connected = false;
            this.error = error.message;
            this.onDisconnect();
            this.onState('reconectando', error.message);
            socket?.close();

            if (Date.now() - openedAt > TIMING.stableConnectionDuration)
                this.attempts = 0;

            const delay = Math.min(this.reconnectDelay * 2 ** this.attempts++, TIMING.maxReconnectDelay);
            this.start(delay);
        };

        try {
            const settings = this.prepareConnection ? await this.prepareConnection() : {};

            if (this.stopped)
                return;

            const parse = this.config.adapter.createParser(this.pairs);
            socket = new this.WebSocketImpl(settings.websocketUrl ?? this.config.websocketUrl);
            this.socket = socket;
            this.connectionTimer = setTimeout(() => fail(new Error('Connection timeout')), TIMING.connectionTimeout);

            socket.addEventListener('open', () => {
                if (!isActive()) {
                    socket.close();
                    return;
                }

                clearTimeout(this.connectionTimer);
                this.connected = true;
                this.error = null;
                this.lastMessage = Date.now();
                this.onState('conectado', null);

                const subscribe = () => {
                    if (!isActive())
                        return;

                    try {
                        for (const subscription of this.config.adapter.subscriptions(this.pairs))
                            socket.send(typeof subscription === 'string' ? subscription : JSON.stringify(subscription));

                    } catch (error) {
                        fail(error);
                    }
                };

                if (settings.subscriptionDelay)
                    this.subscriptionTimer = setTimeout(subscribe, settings.subscriptionDelay);
                else
                    subscribe();

                if (!isActive())
                    return;

                this.watchdog = setInterval(() => {
                    if (Date.now() - this.lastMessage > TIMING.inactivityTimeout)
                        return fail(new Error(`No messages received for ${TIMING.inactivityTimeout / 1000} seconds`));

                    try {
                        if (this.config.adapter.heartbeat) {
                            const heartbeat = this.config.adapter.heartbeat();
                            socket.send(typeof heartbeat === 'string' ? heartbeat : JSON.stringify(heartbeat));

                            if (settings.heartbeatTimeout) {
                                this.pongTimer = setTimeout(() => fail(new Error('Heartbeat pong timeout')), settings.heartbeatTimeout);
                            }
                        }

                    } catch (error) {
                        fail(error);
                    }

                }, settings.heartbeatInterval ?? TIMING.heartbeatInterval);
            });
            socket.addEventListener('message', event => {

                if (!isActive())
                    return;

                this.lastMessage = Date.now();

                try {
                    const message = this.config.adapter.decodeMessage
                        ? this.config.adapter.decodeMessage(event.data)
                        : JSON.parse(event.data);

                    if (message !== null) {
                        const response = this.config.adapter.respondToMessage?.(message);

                        if (response)
                            socket.send(typeof response === 'string' ? response : JSON.stringify(response));

                        if (this.config.adapter.isPong?.(message))
                            clearTimeout(this.pongTimer);

                        this.onTickers(parse(message));
                    }

                } catch (error) {
                    fail(error);
                }
            });

            socket.addEventListener('error', () => fail(new Error('WebSocket connection error')));
            socket.addEventListener('close', event => fail(new Error(`Connection closed (${event.code})`)));

        } catch (error) {
            fail(error);
        }
    }

    stop() {
        this.stopped = true;
        this.connected = false;
        clearTimeout(this.reconnectTimer);
        this.clearConnectionTimers();
        this.socket?.close();
    }
}

export default WebSocketConnectionService;
