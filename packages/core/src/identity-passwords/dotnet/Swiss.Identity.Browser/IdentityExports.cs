using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;

namespace Swiss.Identity.Browser;

[SupportedOSPlatform("browser")]
internal static partial class IdentityExports
{
    private static readonly IdentityPasswordService _service = new();

    [JSExport]
    internal static string Hash(string password) => _service.HashPassword(password);

    [JSExport]
    internal static string Verify(string hash, string password) =>
        _service.VerifyPassword(hash, password).ToString();
}
