import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Dados inválidos',
          message: 'Falha na validação dos campos da requisição.',
          details: error.errors.map((e) => ({
            campo: e.path.join('.'),
            mensagem: e.message
          }))
        });
        return;
      }
      next(error);
    }
  };
}

