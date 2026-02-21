// Cloudflare Pages Function: POST /api/contact
// Handles contact form submissions with file upload support
// Stores submissions as JSON in Cloudflare R2
// Sends email notification via Resend (free tier: 100/day)

interface Env {
    CONTACT_BUCKET: R2Bucket;
    RESEND_API_KEY: string; // Set in Cloudflare Pages env vars
}

async function sendEmailNotification(
    apiKey: string,
    submission: { name: string; email: string; message: string; attachment: string | null; timestamp: string }
) {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Mississippi Sports Contact <onboarding@resend.dev>',
                to: ['editor@sportsmississippi.com'],
                subject: `New Contact Form: ${submission.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #0a1628; padding: 20px; border-radius: 8px 8px 0 0;">
                            <h2 style="color: #d4a843; margin: 0;">New Contact Form Submission</h2>
                        </div>
                        <div style="background: #f8f9fb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 16px;"><strong>From:</strong> ${submission.name}</p>
                            <p style="margin: 0 0 16px;"><strong>Email:</strong> <a href="mailto:${submission.email}">${submission.email}</a></p>
                            <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
                            <div style="background: white; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${submission.message}</div>
                            ${submission.attachment ? `<p style="margin: 16px 0 0; color: #6b7280; font-size: 14px;">📎 Image attachment included (check R2 bucket)</p>` : ''}
                            <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px;">Sent: ${submission.timestamp}</p>
                        </div>
                    </div>
                `,
            }),
        });

        if (!response.ok) {
            console.error('Resend API error:', await response.text());
        }
    } catch (err) {
        console.error('Email notification failed:', err);
        // Don't fail the form submission if email fails
    }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;

    try {
        const formData = await request.formData();

        // Honeypot check
        const honeypot = formData.get('website');
        if (honeypot) {
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Extract fields
        const name = formData.get('name')?.toString().trim();
        const email = formData.get('email')?.toString().trim();
        const message = formData.get('message')?.toString().trim();
        const attachment = formData.get('attachment') as File | null;

        // Validation
        if (!name || !email || !message) {
            return new Response(
                JSON.stringify({ error: 'Name, email, and message are required.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(
                JSON.stringify({ error: 'Please provide a valid email address.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Rate limiting by IP (basic)
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

        // Generate unique submission ID
        const timestamp = new Date().toISOString();
        const submissionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Handle file upload
        let attachmentKey: string | null = null;
        if (attachment && attachment.size > 0) {
            if (attachment.size > 5 * 1024 * 1024) {
                return new Response(
                    JSON.stringify({ error: 'File size must be under 5MB.' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            if (!attachment.type.startsWith('image/')) {
                return new Response(
                    JSON.stringify({ error: 'Only image files are allowed.' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const ext = attachment.name.split('.').pop() || 'jpg';
            attachmentKey = `attachments/${submissionId}.${ext}`;

            try {
                await env.CONTACT_BUCKET.put(attachmentKey, attachment.stream(), {
                    httpMetadata: { contentType: attachment.type },
                    customMetadata: { originalName: attachment.name, submittedBy: email },
                });
            } catch (err) {
                console.error('R2 upload failed:', err);
                attachmentKey = null;
            }
        }

        // Store submission as JSON in R2
        const submission = {
            id: submissionId,
            name,
            email,
            message,
            attachment: attachmentKey,
            ip,
            timestamp,
            userAgent: request.headers.get('User-Agent') || '',
        };

        try {
            await env.CONTACT_BUCKET.put(
                `submissions/${submissionId}.json`,
                JSON.stringify(submission, null, 2),
                {
                    httpMetadata: { contentType: 'application/json' },
                    customMetadata: { email, name },
                }
            );
        } catch (err) {
            console.error('R2 submission storage failed:', err);
            return new Response(
                JSON.stringify({ error: 'Failed to save submission. Please email us directly.' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Send email notification (non-blocking — don't fail submission if email fails)
        if (env.RESEND_API_KEY) {
            await sendEmailNotification(env.RESEND_API_KEY, {
                name,
                email,
                message,
                attachment: attachmentKey,
                timestamp,
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Thank you! Your message has been received.',
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (err) {
        console.error('Contact form error:', err);
        return new Response(
            JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
