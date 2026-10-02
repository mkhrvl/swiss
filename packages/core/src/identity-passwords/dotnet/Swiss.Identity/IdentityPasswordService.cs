using System.Buffers.Binary;
using Microsoft.AspNetCore.Identity;

namespace Swiss.Identity;

/// <summary>Local ASP.NET Identity password hashing and bounded V2/V3 verification.</summary>
public sealed class IdentityPasswordService
{
    private const int MaximumEncodedHashLength = 4096;
    private const uint MaximumIterations = 1_000_000;
    private const int MaximumSubkeyLength = 64;
    private readonly PasswordHasher<object> _hasher = new();
    private readonly object _user = new();

    /// <summary>Generates an Identity V3 hash with a fresh random salt, preserving the password exactly.</summary>
    public string HashPassword(string password)
    {
        ArgumentNullException.ThrowIfNull(password);
        return _hasher.HashPassword(_user, password);
    }

    /// <summary>Verifies a hash without normalizing the password; bounds pasted hashes before PBKDF2.</summary>
    public IdentityVerificationResult VerifyPassword(string hash, string password)
    {
        ArgumentNullException.ThrowIfNull(hash);
        ArgumentNullException.ThrowIfNull(password);
        hash = hash.Trim();
        if (hash.Length is 0 or > MaximumEncodedHashLength)
        {
            return IdentityVerificationResult.InvalidHash;
        }

        byte[] payload;
        try
        {
            payload = Convert.FromBase64String(hash);
        }
        catch (FormatException)
        {
            return IdentityVerificationResult.InvalidHash;
        }

        if (payload.Length == 0)
        {
            return IdentityVerificationResult.InvalidHash;
        }

        if (payload[0] == 0)
        {
            if (payload.Length != 49)
            {
                return IdentityVerificationResult.InvalidHash;
            }
        }
        else if (payload[0] == 1)
        {
            if (payload.Length < 13)
            {
                return IdentityVerificationResult.InvalidHash;
            }

            uint prf = BinaryPrimitives.ReadUInt32BigEndian(payload.AsSpan(1, 4));
            uint iterations = BinaryPrimitives.ReadUInt32BigEndian(payload.AsSpan(5, 4));
            uint saltLength = BinaryPrimitives.ReadUInt32BigEndian(payload.AsSpan(9, 4));
            if (iterations == 0 || saltLength < 16 || saltLength > payload.Length - 13 - 16)
            {
                return IdentityVerificationResult.InvalidHash;
            }

            // PBKDF2 derives one block per PRF output size. Iterations alone do not
            // bound a pasted hash requesting a large subkey (Identity emits 32 bytes).
            int subkeyLength = payload.Length - 13 - (int)saltLength;
            if (prf > 2 || iterations > MaximumIterations || subkeyLength > MaximumSubkeyLength)
            {
                return IdentityVerificationResult.UnsupportedHash;
            }
        }
        else
        {
            return IdentityVerificationResult.UnsupportedHash;
        }

        return _hasher.VerifyHashedPassword(_user, hash, password) switch
        {
            PasswordVerificationResult.Success => IdentityVerificationResult.Success,
            PasswordVerificationResult.SuccessRehashNeeded =>
                IdentityVerificationResult.SuccessRehashNeeded,
            _ => IdentityVerificationResult.Failed,
        };
    }
}
