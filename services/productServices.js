const nodemailer = require('nodemailer');

class MasterService {
    constructor() {
        // Define your email configuration
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'codethelabs@gmail.com',  // Replace with your email
            pass: 'hdpw mbsy xxej crix',         // Replace with your app password
          },
        });
      }
    
      async sendEmail(to, subject, body, title) {
            try {
                // Create email options
                const mailOptions = {
                    from: 'codethelabs@gmail.com',
                    to,
                    subject,
                    html: `<div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; max-width: 400px; margin: 0 auto; display: block; align-items: center;">
                                <div style="height: 80px; width: 100%; background-color: white; display: flex; justify-content: center; align-items: center; text-align: center;">
                                    <h1>${title}</h1>
                                </div>
                                <div>${body}</div>
                            </div>`
                };
        
                // Send the email
                await this.transporter.sendMail(mailOptions);
        
                return { success: true, message: 'Email sent successfully' };
            } catch (error) {
                return { success: false, message: 'Error sending email' };
            }
        }
    
    
    
    
}

module.exports = MasterService;
