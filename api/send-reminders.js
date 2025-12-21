export default async function handler(req, res) {
    // Get current hour in Vietnam timezone (UTC+7)
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const currentHour = vietnamTime.getHours().toString().padStart(2, '0') + ':00';
    
    console.log('Current Vietnam time:', vietnamTime.toISOString());
    console.log('Checking reminders for hour:', currentHour);
    
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
    
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
        return res.status(500).json({ error: 'Missing OneSignal credentials' });
    }
    
    try {
        // Send notification to users with matching reminder_time
        const response = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${ONESIGNAL_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                // Target users with reminder_enabled = true AND reminder_time = current hour
                filters: [
                    { field: 'tag', key: 'reminder_enabled', relation: '=', value: 'true' },
                    { operator: 'AND' },
                    { field: 'tag', key: 'reminder_time', relation: '=', value: currentHour }
                ],
                headings: { en: '📚 VocabMaster' },
                contents: { en: 'Đã đến giờ ôn tập từ vựng! Hãy dành 5 phút để học nhé 🔥' },
                url: 'https://vocabulary.click'
            })
        });
        
        const result = await response.json();
        console.log('OneSignal response:', result);
        
        return res.status(200).json({
            success: true,
            hour: currentHour,
            result: result
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        return res.status(500).json({ error: error.message });
    }
}
