declare module "nodemailer" {
  const nodemailer: {
    createTransport: (options: unknown) => {
      sendMail: (options: unknown) => Promise<{ messageId?: string }>;
    };
  };

  export default nodemailer;
}
