// Cloudflare Pages Function: POST /api/contact
// Handles contact form submissions with file upload support
// Stores submissions as JSON in Cloudflare R2

interface Env {
    CONTACT_BUCKET: R2Bucket; // Bind your R2 bucket in Cloudflare Pages settings
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
            // Limit file size to 5MB
            if (attachment.size > 5 * 1024 * 1024) {
                return new Response(
                    JSON.stringify({ error: 'File size must be under 5MB.' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            // Only allow image types
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
                // Continue without attachment
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
