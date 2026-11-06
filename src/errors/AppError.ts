// Error "controlado": trae el código HTTP y un mensaje apto para mostrar al usuario.
// Cualquier otro error se considera inesperado y se responde como 500 genérico.

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
