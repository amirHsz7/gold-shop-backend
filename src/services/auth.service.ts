
import { prisma } from "../lib/prisma.js";
import { generateOtp, hashOtp } from "../utils/otp.js";
import type { OtpPurpose } from "../generated/prisma/client.js";
import { timingSafeEqual } from "node:crypto";
import type { VerifyOtpInput } from "../schemas/auth.schema.js";
import { AppError } from "../utils/app-error.js";

interface RequestOtpParams {
  mobile: string;
  purpose: OtpPurpose;
  fullName?: string;
}

export async function requestOtp({
  mobile,
  purpose,
  fullName,
}: RequestOtpParams) {
  const existingUser = await prisma.user.findUnique({
    where: { mobile },
  });

  if (purpose === "REGISTER" && existingUser) {
    throw new AppError(
      "این شماره موبایل قبلاً ثبت‌نام کرده است.",
      409,
    );
  }

  if (purpose === "LOGIN" && !existingUser) {
    throw new AppError(
      "حسابی با این شماره موبایل پیدا نشد.",
      404,
    );
  }

  const code = generateOtp();

  if (process.env.NODE_ENV === "development") {
    console.log(`[DEV OTP] ${mobile}: ${code}`);
  }

  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

  await prisma.otp.upsert({
    where: { mobile },
    update: {
      codeHash,
      purpose,
      fullName: purpose === "REGISTER" ? fullName : null,
      expiresAt,
      attempts: 0,
    },
    create: {
      mobile,
      codeHash,
      purpose,
      fullName: purpose === "REGISTER" ? fullName : null,
      expiresAt,
    },
  });

  // فعلاً ارسال پیامک را پیاده‌سازی نکرده‌ایم.
  // کد فقط تولید و هش آن در دیتابیس ذخیره می‌شود.
  return {
    message: "اگر درخواست معتبر باشد، کد تأیید ارسال خواهد شد.",
  };
}


export async function verifyOtp(input: VerifyOtpInput) {
  const { mobile, code, purpose } = input;

  const otp = await prisma.otp.findUnique({
    where: { mobile },
  });

  if (!otp || otp.purpose !== purpose) {
    throw new AppError(
      "کد تأیید نامعتبر است یا وجود ندارد.",
      400,
    );
  }

  if (otp.expiresAt.getTime() <= Date.now()) {
    await prisma.otp.deleteMany({ where: { mobile } });
    throw new AppError("کد تأیید منقضی شده است.", 400);
  }

  if (otp.attempts >= 5) {
    await prisma.otp.deleteMany({ where: { mobile } });
    throw new AppError(
      "تعداد تلاش‌های مجاز به پایان رسیده است.",
      429,
    );
  }

  const submittedHash = hashOtp(code);
  const hashesMatch =
    otp.codeHash.length === submittedHash.length &&
    timingSafeEqual(
      Buffer.from(otp.codeHash, "hex"),
      Buffer.from(submittedHash, "hex"),
    );

  if (!hashesMatch) {
    await prisma.otp.update({
      where: { mobile },
      data: { attempts: { increment: 1 } },
    });

    throw new AppError("کد تأیید اشتباه است.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const currentOtp = await tx.otp.findUnique({
      where: { mobile },
    });

    if (
      !currentOtp ||
      currentOtp.purpose !== purpose ||
      currentOtp.expiresAt.getTime() <= Date.now() ||
      currentOtp.attempts >= 5 ||
      !timingSafeEqual(
        Buffer.from(currentOtp.codeHash, "hex"),
        Buffer.from(submittedHash, "hex"),
      )
    ) {
      throw new AppError("کد تأیید معتبر نیست.", 400);
    }

    let user;

    if (purpose === "REGISTER") {
      if (!currentOtp.fullName) {
      throw new AppError("اطلاعات ثبت‌نام کامل نیست.", 400);
      }

      user = await tx.user.create({
        data: {
          mobile,
          fullName: currentOtp.fullName,
        },
      });
    } else {
      user = await tx.user.findUnique({
        where: { mobile },
      });

      if (!user) {
        throw new Error("حسابی با این شماره موبایل پیدا نشد.");
      }
    }

    await tx.otp.delete({
      where: { mobile },
    });

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        mobile: user.mobile,
        role: user.role,
      },
    };
  });
}
