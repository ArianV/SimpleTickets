// For errors the user can do something about. The message gets shown to them as is.
export class UserError extends Error {
  override name = 'UserError';
}
