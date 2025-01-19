// المتغيرات العامة لتخزين حالة التطبيق وعناصر DOM
let model;                                                  // يخزن نموذج COCO-SSD بعد تحميله
let isVideoPlaying = false;                                // يتتبع ما إذا كانت كاميرا الويب نشطة
const video = document.getElementById('videoElement');      // مرجع لعنصر الفيديو الذي يعرض تغذية كاميرا الويب
const canvas = document.getElementById('canvas');           // عنصر Canvas حيث نرسم مربعات الكشف
const ctx = canvas.getContext('2d');                       // سياق Canvas للرسم
const detectButton = document.getElementById('detectButton');    // زر لتشغيل الكشف عن الأجسام
const toggleVideo = document.getElementById('toggleVideo');      // زر لبدء/إيقاف كاميرا الويب
const resultsDiv = document.getElementById('results');          // عنصر div لعرض نتائج الكشف
const loadingDiv = document.getElementById('loading');          // عنصر div لإظهار حالة التحميل

/**
 * تحميل نموذج COCO-SSD للتعلم الآلي
 * يجب استدعاء هذه الوظيفة قبل إجراء أي عملية كشف
 * @returns {Promise<void>}
 */
async function loadModel() {
    try {
        // إظهار مؤشر التحميل
        loadingDiv.classList.remove('hidden');
        
        // تحميل نموذج COCO-SSD باستخدام TensorFlow.js
        // هذا النموذج يمكنه الكشف عن 90 نوعًا مختلفًا من الأجسام الشائعة
        model = await cocoSsd.load();
        
        console.log('تم تحميل النموذج بنجاح');
        
        // إخفاء مؤشر التحميل وتمكين زر الكشف
        loadingDiv.classList.add('hidden');
        detectButton.disabled = false;
    } catch (error) {
        // معالجة أي أخطاء أثناء تحميل النموذج
        console.error('خطأ في تحميل النموذج:', error);
        loadingDiv.textContent = 'خطأ في تحميل النموذج. يرجى تحديث الصفحة.';
    }
}

/**
 * تهيئة وإعداد بث كاميرا الويب
 * يطلب إذن المستخدم ويقوم بتكوين إعدادات الفيديو
 * @returns {Promise<boolean>} يعيد true إذا نجح إعداد الكاميرا
 */
async function setupCamera() {
    try {
        // طلب الوصول إلى كاميرا الويب بدقة محددة
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: 640,    // طلب دقة HD
                height: 480
            } 
        });
        
        // ربط بث كاميرا الويب بعنصر الفيديو
        video.srcObject = stream;
        isVideoPlaying = true;

        // إرجاع وعد يتم حله عند تحميل بيانات الفيديو التعريفية
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(true);
            };
        });
    } catch (error) {
        // معالجة أي أخطاء في الوصول إلى كاميرا الويب
        console.error('خطأ في الوصول إلى كاميرا الويب:', error);
        resultsDiv.innerHTML = '<p class="error">خطأ في الوصول إلى كاميرا الويب. يرجى التأكد من توصيل الكاميرا ومنح الإذن.</p>';
        return false;
    }
}

/**
 * إيقاف بث كاميرا الويب وتنظيف الموارد
 * يتم استدعاؤها عند إيقاف تشغيل الكاميرا
 */
function stopCamera() {
    const stream = video.srcObject;
    if (stream) {
        // إيقاف جميع المسارات في البث
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        
        // مسح مصدر الفيديو
        video.srcObject = null;
        isVideoPlaying = false;
    }
}

/**
 * الوظيفة الرئيسية للكشف عن الأجسام
 * تلتقط إطار الفيديو الحالي وتجري عملية الكشف عن الأجسام
 * @returns {Promise<void>}
 */
async function detectObjects() {
    // التحقق مما إذا كانت الكاميرا نشطة
    if (!isVideoPlaying) {
        resultsDiv.innerHTML = '<p class="error">يرجى تشغيل الكاميرا أولاً.</p>';
        return;
    }

    try {
        // رسم إطار الفيديو الحالي على Canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // إجراء الكشف عن الأجسام على إطار الفيديو الحالي
        const predictions = await model.detect(video);
        console.log('التنبؤات:', predictions); // سجل للتصحيح
        
        // مسح الرسومات السابقة من Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // إعادة رسم إطار الفيديو الحالي
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // عرض النتائج ورسم المربعات المحيطة
        displayResults(predictions);
        drawBoxes(predictions);
    } catch (error) {
        // معالجة أي أخطاء أثناء الكشف
        console.error('خطأ أثناء الكشف:', error);
        resultsDiv.innerHTML = '<p class="error">خطأ أثناء الكشف. يرجى المحاولة مرة أخرى.</p>';
    }
}

/**
 * عرض نتائج الكشف في عنصر النتائج
 * @param {Array} predictions مصفوفة نتائج الكشف من النموذج
 */
function displayResults(predictions) {
    // تهيئة عرض النتائج
    resultsDiv.innerHTML = '<h3>الأجسام المكتشفة:</h3>';
    
    // معالجة حالة عدم اكتشاف أي أجسام
    if (predictions.length === 0) {
        resultsDiv.innerHTML += '<p>لم يتم اكتشاف أي أجسام</p>';
        return;
    }
    
    // عرض كل جسم تم اكتشافه ودرجة الثقة
    predictions.forEach(prediction => {
        const confidence = Math.round(prediction.score * 100);
        resultsDiv.innerHTML += `
            <p>${prediction.class} - نسبة الثقة: ${confidence}%</p>
        `;
    });
}

/**
 * رسم المربعات المحيطة والتسميات على Canvas للأجسام المكتشفة
 * @param {Array} predictions مصفوفة نتائج الكشف من النموذج
 */
function drawBoxes(predictions) {
    predictions.forEach(prediction => {
        // استخراج إحداثيات المربع المحيط
        const [x, y, width, height] = prediction.bbox;
        
        // رسم المربع المحيط
        ctx.strokeStyle = '#00ff00';  // لون أخضر للمربع
        ctx.lineWidth = 4;            // سمك خطوط المربع
        ctx.strokeRect(x, y, width, height);
        
        // تحضير نص التسمية
        const label = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
        ctx.font = '18px Arial';
        const labelWidth = ctx.measureText(label).width;
        
        // رسم خلفية التسمية
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';  // خلفية سوداء شبه شفافة
        ctx.fillRect(x, y > 10 ? y - 25 : 0, labelWidth + 10, 25);
        
        // رسم نص التسمية
        ctx.fillStyle = '#00ff00';  // لون النص أخضر
        ctx.fillText(label, x + 5, y > 10 ? y - 7 : 18);
    });
}

/**
 * تهيئة التطبيق
 * تحميل النموذج وإعداد مستمعي الأحداث
 * @returns {Promise<void>}
 */
async function init() {
    // تعطيل زر الكشف حتى يتم تحميل النموذج
    detectButton.disabled = true;
    
    // تحميل نموذج COCO-SSD
    await loadModel();
    
    // إعداد مستمع أحداث زر تبديل الكاميرا
    toggleVideo.addEventListener('click', async () => {
        if (isVideoPlaying) {
            // إيقاف الكاميرا إذا كانت قيد التشغيل
            stopCamera();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            resultsDiv.innerHTML = '';
        } else {
            // تشغيل الكاميرا إذا كانت متوقفة
            await setupCamera();
        }
    });
    
    // إعداد مستمع أحداث زر الكشف
    detectButton.addEventListener('click', detectObjects);
}
init();