class TikTokDownloader {
    constructor() {
        this.currentApiIndex = 0;
        this.apiUrls = [
            'https://api.tiklydown.eu.org/api/download',
            'https://www.tikwm.com/api/',
            'https://tikdown.org/getAjax'
        ];
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Enter key support
        document.getElementById('tiktokUrl').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.downloadVideo();
            }
        });

        // Auto-clear error when typing
        document.getElementById('tiktokUrl').addEventListener('input', () => {
            this.hideError();
        });
    }

    async downloadVideo() {
        const urlInput = document.getElementById('tiktokUrl');
        const url = urlInput.value.trim();
        
        // Validasi input
        if (!url) {
            this.showError('Silakan masukkan link TikTok terlebih dahulu');
            return;
        }

        if (!this.isValidTikTokUrl(url)) {
            this.showError('Format link TikTok tidak valid. Pastikan link dari TikTok.com');
            return;
        }

        // UI state update
        this.setLoadingState(true);
        this.hideError();
        this.hideResult();

        try {
            const videoData = await this.fetchVideoData(url);
            await this.displayVideoResult(videoData);
        } catch (error) {
            console.error('Download error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.setLoadingState(false);
        }
    }

    isValidTikTokUrl(url) {
        const tiktokPatterns = [
            /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\/.+\/video\/\d+/,
            /https?:\/\/(www\.)?tiktok\.com\/@.+\/video\/\d+/,
            /https?:\/\/vm\.tiktok\.com\/\w+/,
            /https?:\/\/vt\.tiktok\.com\/\w+/
        ];
        
        return tiktokPatterns.some(pattern => pattern.test(url));
    }

    async fetchVideoData(url) {
        for (let attempt = 0; attempt < this.apiUrls.length; attempt++) {
            try {
                const apiUrl = this.apiUrls[this.currentApiIndex];
                console.log(`Mencoba API: ${apiUrl}`);
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ url: url })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                // Handle different API response formats
                if (data.data && data.data.play) {
                    return data.data;
                } else if (data.play) {
                    return data;
                } else if (data.video && data.video.downloadAddr) {
                    return data;
                }
                
                throw new Error('Format response tidak dikenali');
                
            } catch (error) {
                console.warn(`API ${this.currentApiIndex} gagal:`, error);
                this.currentApiIndex = (this.currentApiIndex + 1) % this.apiUrls.length;
                
                if (attempt === this.apiUrls.length - 1) {
                    throw new Error('Semua server sedang sibuk. Coba lagi dalam beberapa menit.');
                }
                
                // Tunggu sebentar sebelum mencoba API berikutnya
                await this.delay(1000);
            }
        }
    }

    async displayVideoResult(videoData) {
        // Extract video URL based on different API response formats
        let videoUrl = videoData.play || 
                      (videoData.video && videoData.video.downloadAddr) ||
                      (videoData.download && videoData.download.url);

        let audioUrl = videoData.music || 
                      (videoData.musicInfo && videoData.musicInfo.playUrl);

        if (!videoUrl) {
            throw new Error('Tidak dapat menemukan video tanpa watermark');
        }

        // Ensure URL is absolute
        if (videoUrl.startsWith('//')) {
            videoUrl = 'https:' + videoUrl;
        }
        if (audioUrl && audioUrl.startsWith('//')) {
            audioUrl = 'https:' + audioUrl;
        }

        // Setup video player
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.src = videoUrl;
        
        // Wait for video metadata to load
        await new Promise((resolve, reject) => {
            videoPlayer.onloadedmetadata = resolve;
            videoPlayer.onerror = reject;
            setTimeout(resolve, 3000); // Fallback timeout
        });

        // Update video info
        this.updateVideoInfo(videoData);

        // Setup download buttons
        this.setupDownloadButtons(videoUrl, audioUrl, videoData);

        this.showResult();
    }

    updateVideoInfo(videoData) {
        const title = videoData.title || 
                     (videoData.video && videoData.video.description) || 
                     'Video TikTok';
        
        const author = videoData.author || 
                      (videoData.video && videoData.video.author && videoData.video.author.nickname) ||
                      'Unknown Author';

        document.getElementById('videoTitle').textContent = title.length > 100 ? title.substring(0, 100) + '...' : title;
        document.getElementById('videoAuthor').textContent = `By: ${author}`;
    }

    setupDownloadButtons(videoUrl, audioUrl, videoData) {
        const downloadVideoBtn = document.getElementById('downloadVideoBtn');
        const downloadAudioBtn = document.getElementById('downloadAudioBtn');

        // Generate filename
        const author = videoData.author || 'tiktok';
        const timestamp = new Date().getTime();
        const videoFilename = `tiktok_${author}_${timestamp}.mp4`;
        const audioFilename = `tiktok_audio_${author}_${timestamp}.mp3`;

        // Video download
        downloadVideoBtn.onclick = () => {
            this.downloadFile(videoUrl, videoFilename);
            this.trackDownload('video');
        };

        // Audio download (if available)
        if (audioUrl) {
            downloadAudioBtn.onclick = () => {
                this.downloadFile(audioUrl, audioFilename);
                this.trackDownload('audio');
            };
            downloadAudioBtn.style.display = 'flex';
        } else {
            downloadAudioBtn.style.display = 'none';
        }
    }

    downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    trackDownload(type) {
        console.log(`Download ${type} triggered`);
        // Bisa ditambahkan analytics tracking di sini
    }

    getErrorMessage(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('server') || message.includes('busy')) {
            return 'Server sedang sibuk. Silakan coba lagi dalam beberapa menit.';
        } else if (message.includes('format') || message.includes('recognize')) {
            return 'Link TikTok tidak valid atau tidak support. Coba link yang lain.';
        } else if (message.includes('network') || message.includes('fetch')) {
            return 'Koneksi internet bermasalah. Periksa koneksi Anda.';
        } else {
            return 'Terjadi kesalahan. Pastikan link TikTok valid dan coba lagi.';
        }
    }

    setLoadingState(loading) {
        const btn = document.getElementById('downloadBtn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        const loadingDiv = document.getElementById('loading');

        if (loading) {
            btn.disabled = true;
            btnText.classList.add('hidden');
            btnLoading.classList.remove('hidden');
            loadingDiv.classList.remove('hidden');
        } else {
            btn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            loadingDiv.classList.add('hidden');
        }
    }

    showResult() {
        document.getElementById('result').classList.remove('hidden');
        // Scroll ke result section
        document.getElementById('result').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
        });
    }

    hideResult() {
        document.getElementById('result').classList.add('hidden');
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = message;
        errorDiv.classList.remove('hidden');
        
        // Scroll ke error message
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the downloader when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.downloader = new TikTokDownloader();
});

// Global function untuk button HTML
function downloadVideo() {
    if (window.downloader) {
        window.downloader.downloadVideo();
    }
}
