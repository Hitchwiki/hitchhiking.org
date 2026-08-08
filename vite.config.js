import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'canonical-chat-path',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === '/chat') {
          response.statusCode = 308;
          response.setHeader('Location', '/chat/');
          response.end();
          return;
        }
        next();
      });
    },
  }],
  server: {
    proxy: {
      '/chat/auth': {
        target: 'http://127.0.0.1:8790',
        rewrite: (path) => path.replace(/^\/chat\/auth/, ''),
      },
    },
  },
});
