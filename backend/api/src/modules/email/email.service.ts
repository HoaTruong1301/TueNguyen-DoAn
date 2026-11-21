
import nodemailer from "nodemailer";

function getTransporter() {
  const emailUser = process.env.SMTP_USER;
  const emailPassword = process.env.SMTP_APP_PASSWORD;

  if (!emailUser || !emailPassword) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
}

console.log("SMTP DEBUG:", {
  nodeOptions: process.env.NODE_OPTIONS,
  nodeVersion: process.version,
  nodeEnv: process.env.NODE_ENV,
});

/**
 * Kiểm tra kết nối SMTP.
 */
export async function testSmtpConnection() {
  const transporter = getTransporter();
  await transporter.verify();
}

/**
 * Gửi mã xác minh email.
 */
export async function sendVerificationEmail(
  email: string,
  token: string
) {
  const transporter = getTransporter();
  const emailUser = process.env.SMTP_USER!;

  await transporter.sendMail({
    from: `"Tuệ Nguyên" <${emailUser}>`,
    to: email,
    subject: "Mã xác minh tài khoản Tuệ Nguyên",
    text: [
      "Xin chào!",
      "",
      "Cảm ơn bạn đã đăng ký tài khoản Tuệ Nguyên.",
      "",
      "Mã xác minh email của bạn là:",
      token,
      "",
      "Mã có hiệu lực trong 15 phút.",
      "Vui lòng không chia sẻ mã này với bất kỳ ai.",
      "",
      "Nếu bạn không thực hiện đăng ký, vui lòng bỏ qua email này.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2>Chào mừng bạn đến với Tuệ Nguyên!</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản.</p>
        <p>Mã xác minh email của bạn là:</p>
        <div style="
          padding:18px;
          background:#f3f5f3;
          border-radius:8px;
          text-align:center;
          font-size:26px;
          font-weight:bold;
          letter-spacing:5px;
        ">
          ${token}
        </div>
        <p>Mã có hiệu lực trong <strong>15 phút</strong>.</p>
        <p>Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <p>Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.</p>
      </div>
    `,
  });
}
