namespace Swiss.Identity;

/// <summary>Distinguishes malformed or unsupported hashes from password verification outcomes.</summary>
public enum IdentityVerificationResult
{
    /// <summary>The hash is malformed or exceeds the encoded length limit.</summary>
    InvalidHash,

    /// <summary>The format, PRF or iteration count is unsupported.</summary>
    UnsupportedHash,

    /// <summary>The password does not match.</summary>
    Failed,

    /// <summary>The password matches the current format and work factor.</summary>
    Success,

    /// <summary>The password matches, but Microsoft Identity recommends upgrading the hash.</summary>
    SuccessRehashNeeded,
}
