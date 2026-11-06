import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IEQ - Sistema da Igreja API',
      version: '1.0.0',
      description: 'Documentação da API REST do Sistema de Gestão da Igreja (IEQ)',
      contact: {
        name: 'Suporte IEQ'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Servidor de Desenvolvimento Local'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Insira o token JWT de acesso retornado no login'
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ]
  },
  apis: ['./src/modules/**/*.routes.ts', './src/routes.ts']
};

export const swaggerSpec = swaggerJSDoc(options);
