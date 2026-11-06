import { ZodError } from '../config/zodFallback.ts';

export function validate(schema: any) {
  return async (req: any, res: any, next: (err?: any) => void): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error.message) {
        res.status(400).json({
          error: 'Dados inválidos',
          message: error.message || 'Falha na validação dos campos da requisição.'
        });
        return;
      }
      next(error);
    }
  };
}

