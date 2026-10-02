using System.Buffers.Binary;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Swiss.Identity.Tests;

public sealed class IdentityPasswordServiceTests
{
    [Fact]
    public void HashPassword_creates_salted_hashes_accepted_by_Identity()
    {
        var service = new IdentityPasswordService();
        var referenceHasher = new PasswordHasher<object>();
        var user = new object();

        string first = service.HashPassword("a sample password");
        string second = service.HashPassword("a sample password");

        first.Should().NotBe(second);
        referenceHasher
            .VerifyHashedPassword(user, first, "a sample password")
            .Should()
            .Be(PasswordVerificationResult.Success);
        referenceHasher
            .VerifyHashedPassword(user, second, "a sample password")
            .Should()
            .Be(PasswordVerificationResult.Success);
    }

    [Fact]
    public void VerifyPassword_matches_a_hash_created_by_Identity()
    {
        var service = new IdentityPasswordService();
        string hash = new PasswordHasher<object>().HashPassword(new object(), "correct password");

        IdentityVerificationResult result = service.VerifyPassword(hash, "correct password");

        result.Should().Be(IdentityVerificationResult.Success);
    }

    [Fact]
    public void VerifyPassword_rejects_an_incorrect_password()
    {
        var service = new IdentityPasswordService();
        string hash = new PasswordHasher<object>().HashPassword(new object(), "correct password");

        IdentityVerificationResult result = service.VerifyPassword(hash, "incorrect password");

        result.Should().Be(IdentityVerificationResult.Failed);
    }

    [Theory]
    [InlineData(PasswordHasherCompatibilityMode.IdentityV2, 100_000)]
    [InlineData(PasswordHasherCompatibilityMode.IdentityV3, 10_000)]
    public void VerifyPassword_recognizes_matching_hashes_that_need_upgrading(
        PasswordHasherCompatibilityMode mode,
        int iterations
    )
    {
        var service = new IdentityPasswordService();
        var legacyHasher = new PasswordHasher<object>(
            Options.Create(
                new PasswordHasherOptions { CompatibilityMode = mode, IterationCount = iterations }
            )
        );
        string hash = legacyHasher.HashPassword(new object(), "correct password");

        IdentityVerificationResult result = service.VerifyPassword(hash, "correct password");

        result.Should().Be(IdentityVerificationResult.SuccessRehashNeeded);
    }

    [Fact]
    public void VerifyPassword_preserves_password_spaces_and_unicode()
    {
        var service = new IdentityPasswordService();
        string hash = new PasswordHasher<object>().HashPassword(new object(), "  café 🔐  ");

        IdentityVerificationResult result = service.VerifyPassword(
            " \n" + hash + "\n ",
            "  café 🔐  "
        );

        result.Should().Be(IdentityVerificationResult.Success);
        service.VerifyPassword(hash, "café 🔐").Should().Be(IdentityVerificationResult.Failed);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not a hash!")]
    [InlineData("AA==")]
    [InlineData("AQ==")]
    [InlineData("AQAAAAAAAAAAAAAAAA==")]
    public void VerifyPassword_reports_malformed_hashes_without_throwing(string hash)
    {
        var service = new IdentityPasswordService();

        IdentityVerificationResult result = service.VerifyPassword(hash, "password");

        result.Should().Be(IdentityVerificationResult.InvalidHash);
    }

    [Fact]
    public void VerifyPassword_rejects_excessive_work_in_a_pasted_hash()
    {
        var service = new IdentityPasswordService();
        var payload = new byte[61];
        payload[0] = 1;
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(1, 4), 2);
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(5, 4), uint.MaxValue);
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(9, 4), 16);

        IdentityVerificationResult result = service.VerifyPassword(
            Convert.ToBase64String(payload),
            "password"
        );

        result.Should().Be(IdentityVerificationResult.UnsupportedHash);
    }

    [Theory]
    [InlineData(2, 0, 16, IdentityVerificationResult.InvalidHash)]
    [InlineData(2, 100_000, 15, IdentityVerificationResult.InvalidHash)]
    [InlineData(2, 100_000, int.MaxValue, IdentityVerificationResult.InvalidHash)]
    [InlineData(3, 100_000, 16, IdentityVerificationResult.UnsupportedHash)]
    public void VerifyPassword_bounds_header_parameters_before_deriving_a_key(
        uint prf,
        uint iterations,
        uint saltLength,
        IdentityVerificationResult expected
    )
    {
        var payload = new byte[61];
        payload[0] = 1;
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(1, 4), prf);
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(5, 4), iterations);
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(9, 4), saltLength);

        new IdentityPasswordService()
            .VerifyPassword(Convert.ToBase64String(payload), "password")
            .Should()
            .Be(expected);
    }

    [Fact]
    public void VerifyPassword_rejects_an_oversized_encoded_hash()
    {
        new IdentityPasswordService()
            .VerifyPassword(new string('A', 4097), "password")
            .Should()
            .Be(IdentityVerificationResult.InvalidHash);
    }

    [Theory]
    [InlineData(65)]
    [InlineData(2048)]
    public void VerifyPassword_rejects_a_large_subkey_before_deriving_it(int subkeyLength)
    {
        var payload = new byte[13 + 16 + subkeyLength];
        payload[0] = 1;
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(1, 4), 2);
        // A low iteration count keeps the pre-fix reproduction fast.
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(5, 4), 1);
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(9, 4), 16);

        new IdentityPasswordService()
            .VerifyPassword(Convert.ToBase64String(payload), "password")
            .Should()
            .Be(IdentityVerificationResult.UnsupportedHash);
    }

    [Theory]
    [InlineData(16)]
    [InlineData(32)]
    [InlineData(64)]
    public void VerifyPassword_accepts_subkey_lengths_within_the_work_bound(int subkeyLength)
    {
        var payload = new byte[13 + 16 + subkeyLength];
        payload[0] = 1;
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(1, 4), 2);
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(5, 4), 1);
        BinaryPrimitives.WriteUInt32BigEndian(payload.AsSpan(9, 4), 16);

        new IdentityPasswordService()
            .VerifyPassword(Convert.ToBase64String(payload), "password")
            .Should()
            .Be(IdentityVerificationResult.Failed);
    }
}
