// Copied beside the published runtime, preserving .NET's relative asset URLs.
// Never report exception details: they could contain the request's secrets.
try {
  const { dotnet } = await import('./_framework/dotnet.js');
  const runtime = await dotnet.create();
  const exports = await runtime.getAssemblyExports(
    runtime.getConfig().mainAssemblyName,
  );
  const identity = exports.Swiss.Identity.Browser.IdentityExports;
  globalThis.onmessage = ({ data }) => {
    try {
      const value =
        data.operation === 'hash'
          ? identity.Hash(data.password)
          : identity.Verify(data.hash, data.password);
      globalThis.postMessage({ kind: 'result', value });
    } catch {
      globalThis.postMessage({ kind: 'failure' });
    }
  };
  globalThis.postMessage({ kind: 'ready' });
} catch {
  globalThis.postMessage({ kind: 'failure' });
}
