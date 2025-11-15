/**
 * API client helper for Blackjack backend endpoints.
 * Handles JSON parsing, error reporting, and exposes specific actions.
 */

const DEFAULT_API_ERROR_MESSAGE = 'Unable to complete request';

const defaultShowMessage = () => {};

const buildQueryString = (params = {}) => {
    const entries = Object.entries(params).filter(
        ([, value]) => value !== undefined && value !== null && value !== ''
    );

    if (!entries.length) {
        return '';
    }

    return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`;
};

export class ApiClient {
    constructor({ onMessage = defaultShowMessage, logger = console } = {}) {
        this.onMessage = onMessage;
        this.logger = logger;
    }

    async request(endpoint, method = 'POST', data = {}) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (method !== 'GET' && Object.keys(data).length > 0) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(endpoint, options);
            const contentType = response.headers.get('content-type');

            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                const preview = text.substring(0, 100);
                this.logger.error('Invalid response format', { endpoint, status: response.status, preview });
                throw new Error(`Server error (${response.status}): Invalid response format`);
            }

            const payload = await response.json();

            if (!response.ok) {
                const errorMsg = payload.error || payload.message || `HTTP ${response.status}: ${response.statusText}`;
                this.logger.error('API Error Response', payload);
                throw new Error(errorMsg);
            }

            return payload;
        } catch (error) {
            const message = error?.message || DEFAULT_API_ERROR_MESSAGE;
            this.logger.error('API request failed', { endpoint, method, data, message });
            this.onMessage(`Error: ${message}`, 'error');
            throw error;
        }
    }

    forceDealerHand(payload) {
        return this.request('/api/force_dealer_hand', 'POST', payload);
    }

    requestInsurance(payload) {
        return this.request('/api/insurance', 'POST', payload);
    }

    startNewGame(payload) {
        return this.request('/api/new_game', 'POST', payload);
    }

    placeBet(payload) {
        return this.request('/api/bet', 'POST', payload);
    }

    deal(payload) {
        return this.request('/api/deal', 'POST', payload);
    }

    hit(payload) {
        return this.request('/api/hit', 'POST', payload);
    }

    stand(payload) {
        return this.request('/api/stand', 'POST', payload);
    }

    surrender(payload) {
        return this.request('/api/surrender', 'POST', payload);
    }

    doubleDown(payload) {
        return this.request('/api/double_down', 'POST', payload);
    }

    split(payload) {
        return this.request('/api/split', 'POST', payload);
    }

    fetchGameState(gameId) {
        const query = buildQueryString({ game_id: gameId });
        return this.request(`/api/game_state${query}`, 'GET');
    }

    startAutoMode(payload) {
        return this.request('/api/auto_mode/start', 'POST', payload);
    }

    logHand(payload) {
        return this.request('/api/log_hand', 'POST', payload);
    }

    clearLog(payload) {
        return this.request('/api/clear_log_hand', 'POST', payload);
    }

    getAutoModeLogUrl(gameId, filename) {
        if (!gameId || !filename) {
            return null;
        }

        const query = buildQueryString({
            game_id: gameId,
            filename
        });
        return `/api/auto_mode/download_log${query}`;
    }

    getLogHandUrl(gameId) {
        if (!gameId) {
            return null;
        }

        const query = buildQueryString({ game_id: gameId });
        return `/api/download_log_hand${query}`;
    }
}

