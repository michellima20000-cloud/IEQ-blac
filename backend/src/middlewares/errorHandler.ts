import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno no servidor.';

  // Log estruturado em JSON
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      statusCode,
      errorName: err.name,
      message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  );

  res.status(statusCode).json({
    error: err.name || 'ErroInterno',
    message,
    timestamp: new Date().toISOString()
  });
}
