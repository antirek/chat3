// Конфигурация портов для разных сервисов
window.CHAT3_CONFIG = {
    TENANT_API_PORT: 3000,
    ADMIN_WEB_PORT: 3001,
    CONTROL_API_PORT: 3002,
    API_TEST_PORT: 3003,
    
    getTenantApiUrl: function(path = '') {
        return `http://localhost:${this.TENANT_API_PORT}${path}`;
    },
    
    getControlApiUrl: function(path = '') {
        return `http://localhost:${this.CONTROL_API_PORT}${path}`;
    },
    
    getAdminWebUrl: function(path = '') {
        return `http://localhost:${this.ADMIN_WEB_PORT}${path}`;
    }
};

