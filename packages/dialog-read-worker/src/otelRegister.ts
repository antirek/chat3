import { initOtel } from '@chat3/utils/otel.js';

initOtel({ instrumentations: ['mongoose'] });
