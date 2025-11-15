export function getMetaScopeOptions(req, fallbackScope) {
  if (req?.query && Object.prototype.hasOwnProperty.call(req.query, 'metaScope')) {
    return { scope: req.query.metaScope };
  }

  if (req?.query && Object.prototype.hasOwnProperty.call(req.query, 'scope')) {
    return { scope: req.query.scope };
  }

  if (typeof fallbackScope !== 'undefined') {
    return { scope: fallbackScope };
  }

  return undefined;
}


