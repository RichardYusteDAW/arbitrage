import { TIMING } from '../../config.js';

class WebSocketConnectionService {
    
    constructor({ 
        exchangeName, 
        config,
        pairs, 
        WebSocketImpl = globalThis.WebSocket,
        reconnectDelay = TIMING.reconnectDelay, 
        onTickers, 
        onDisconnect, 
        onState 
    }) {
        this.exchangeName = exchangeName;
        this.config = config;
        this.pairs = pairs;
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
        clearInterval(this.watchdog);
    }

    connect() {
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
            const parse = this.config.adapter.createParser(this.pairs);
            socket = new this.WebSocketImpl(this.config.websocketUrl);
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

                try {
                    for (const subscription of this.config.adapter.subscriptions(this.pairs))
                        socket.send(JSON.stringify(subscription));

                } catch (error) {
                    fail(error); return;
                }

                this.watchdog = setInterval(() => {
                    if (Date.now() - this.lastMessage > TIMING.inactivityTimeout)
                        return fail(new Error(`No messages received for ${TIMING.inactivityTimeout / 1000} seconds`));

                    try {
                        if (this.config.adapter.heartbeat)
                            socket.send(JSON.stringify(this.config.adapter.heartbeat()));

                    } catch (error) {
                        fail(error);
                    }

                }, TIMING.heartbeatInterval);
            });
            socket.addEventListener('message', event => {

                if (!isActive())
                    return;

                this.lastMessage = Date.now();

                try {
                    this.onTickers(parse(JSON.parse(event.data)));

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