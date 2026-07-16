function ensureSiteNavbar() {
    if (document.querySelector('.navbar')) {
        return document.querySelector('.navbar');
    }

    // Calculate the correct path to index.html based on current location
    function getHomeLink() {
        const pathname = window.location.pathname;
        const depth = (pathname.match(/\//g) || []).length - 2; // Minus 1 for leading /, minus 1 for filename
        
        if (pathname.endsWith('index.html') || pathname.endsWith('/')) {
            return 'index.html';
        }
        
        // If we're in a subfolder, go back the appropriate number of levels
        if (depth > 0) {
            return '../'.repeat(depth) + 'index.html';
        }
        
        return 'index.html';
    }

    const navMarkup = `
        <nav class="navbar">
            <div class="nav-container">
                <a href="${getHomeLink()}" class="logo">
                    <span class="logo-text">GU</span><span class="logo-accent">GUIDE</span>
                </a>

                <div class="nav-links">
                    <a href="#" class="btn btn-primary" style="color: #ffffff; padding: 8px 16px;">
                        <img src="assets/images/icons/discord_icon.ico" alt="Discord" class="nav-game-icon" onerror="this.style.display='none'">
                        เข้าร่วม Discord
                    </a>
                </div>
            </div>
        </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', navMarkup);
    return document.querySelector('.navbar');
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Navbar scroll effect ---
    const navbar = ensureSiteNavbar();
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // --- Smooth scrolling for anchor links ---
    // Make sure we only target hash links
    document.body.addEventListener('click', function(e) {
        const anchor = e.target.closest('a[href^="#"]');
        if (anchor) {
            e.preventDefault();
            const targetId = anchor.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });

    // --- Mobile menu toggle ---
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileBtn && navLinks) {
        mobileBtn.addEventListener('click', () => {
            mobileBtn.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
        
        // Close menu when clicking outside or on a link
        document.addEventListener('click', (e) => {
            if (!mobileBtn.contains(e.target) && !navLinks.contains(e.target)) {
                mobileBtn.classList.remove('active');
                navLinks.classList.remove('active');
            }
        });
    }

    // --- SPA Routing Logic ---
    const appContent = document.getElementById('app-content');
    
    // Helper: get base path for Subfolder deployments
    function getBasePath() {
        return window.location.pathname.includes('/GUGUIDE') ? '/GUGUIDE' : '';
    }

    async function loadPage(url, pushHistory = true) {
        if (!appContent) return;
        
        try {
            // Show loading state
            appContent.classList.add('loading');
            
            // Wait a tiny bit for the CSS transition to start
            await new Promise(r => setTimeout(r, 150));
            
            // Normalize path for local file fetching
            let fetchUrl = url;
            if (url === '/' || url === getBasePath() + '/') {
                // We no longer fetch a home partial, the home content is built into index.html
                // Or if we need to reload home, we fetch index.html and extract its #app-content
                fetchUrl = getBasePath() + '/index.html';
            }
            
            // Allow fetch() to handle absolute and relative URLs natively
            // If it starts with '/', it fetches from domain root. 
            // If relative, it fetches relative to current browser path.
            
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error('Page not found');
            
            const htmlText = await response.text();
            
            // Parse the fetched HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            // Extract title
            if (doc.title) {
                document.title = doc.title;
            }

            // If the fetched page is a full HTML page (like index.html or global-sitemap.html),
            // extract ONLY the #app-content to avoid duplicating nav and footer.
            const fetchedAppContent = doc.querySelector('#app-content');
            if (fetchedAppContent) {
                appContent.innerHTML = fetchedAppContent.innerHTML;
            } else {
                // Otherwise inject the whole body (for partial pages)
                appContent.innerHTML = doc.body.innerHTML;
                
                // Clean up unwanted elements (like scripts or duplicate footers from the fetched page)
                const scripts = appContent.querySelectorAll('script');
                scripts.forEach(s => s.remove());
                const footerPlaceholder = appContent.querySelector('#footer-placeholder');
                if (footerPlaceholder) footerPlaceholder.remove();
            }
            
            // Update active state in Navbar
            updateNavbarActiveState(url);
            
            // Push history state
            if (pushHistory) {
                window.history.pushState({ path: url }, doc.title, url);
            }
            
            // Scroll to top
            window.scrollTo(0, 0);

            // Initialize page specific scripts
            initPageScripts();
            
        } catch (error) {
            console.error('Error loading page:', error);
            appContent.innerHTML = `
                <div style="text-align: center; padding: 100px 20px;">
                    <h2>เกิดข้อผิดพลาดในการโหลดเนื้อหา</h2>
                    <p>กรุณาลองใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</p>
                    <p style="font-size: 0.8rem; color: #888;">(หากเปิดจากไฟล์บนเครื่องโดยตรง อาจติดปัญหา CORS แนะนำให้รันผ่าน Local Server)</p>
                </div>
            `;
        } finally {
            // Small delay to allow new content to render before fading in
            setTimeout(() => {
                appContent.classList.remove('loading');
            }, 50);
        }
    }

    function updateNavbarActiveState(currentPath) {
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            const linkHref = link.getAttribute('href');
            
            if (linkHref !== '/' && linkHref !== '#' && currentPath.includes(linkHref)) {
                link.classList.add('active');
            } else if (linkHref === '/' && (currentPath === '/' || currentPath.includes('home.html') || currentPath.includes('index.html'))) {
                link.classList.add('active');
            }
        });
    }

    // Intercept only SPA-style links that do not point to a real HTML page.
    document.body.addEventListener('click', e => {
        // Find closest anchor tag
        const link = e.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Let external links, hash links, and regular HTML page links work normally.
        if (!href || href.startsWith('http') || href.startsWith('#') || link.target === '_blank' || href.startsWith('mailto:')) {
            return;
        }

        const isPageLink = /\.(html|htm|php|aspx|jsp)$/i.test(href);
        if (isPageLink) {
            return;
        }
        
        e.preventDefault();
        
        // Close mobile menu if open
        if (navLinks && navLinks.classList.contains('active')) {
            mobileBtn.classList.remove('active');
            navLinks.classList.remove('active');
        }

        loadPage(href);
    });

    // Handle Back/Forward buttons
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path) {
            loadPage(e.state.path, false);
        } else {
            loadPage(window.location.pathname, false);
        }
    });

    // --- Tooltip System ---
    function setupTooltip() {
        let tooltip = document.getElementById('item-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'item-tooltip';
            document.body.appendChild(tooltip);
        }

        function showTooltip(trigger, pageX, pageY) {
            const title = trigger.getAttribute('data-tooltip-title') || '';
            const type = trigger.getAttribute('data-tooltip-type') || '';
            const desc = trigger.getAttribute('data-tooltip-desc') || '';
            const flavor = trigger.getAttribute('data-tooltip-flavor') || '';

            // Determine rarity color from class
            let color = '#fff';
            let bgColor = 'rgba(0,0,0,0.95)';
            if (trigger.classList.contains('rarity-unique')) { color = '#af6025'; bgColor = 'rgba(175, 96, 37, 0.1)'; }
            else if (trigger.classList.contains('rarity-rare')) { color = '#ffff00'; }
            else if (trigger.classList.contains('rarity-magic')) { color = '#8888ff'; }
            else if (trigger.classList.contains('rarity-gem')) { color = '#1ba29b'; }

            let html = `
                <div class="tooltip-header" style="background: ${bgColor}; border-color: ${color}">
                    <h3 style="color: ${color}">${title}</h3>
                    ${type ? `<div class="type-line">${type}</div>` : ''}
                </div>
                <div class="tooltip-body">
                    ${desc}
                    ${flavor ? `<div class="tooltip-flavor">${flavor}</div>` : ''}
                </div>
            `;

            tooltip.innerHTML = html;
            tooltip.style.display = 'block';
            tooltip.style.borderColor = color;
            
            positionTooltip(pageX, pageY);
        }
        
        function positionTooltip(pageX, pageY) {
            if (tooltip.style.display === 'none') return;
            
            let x = pageX + 15;
            let y = pageY + 15;

            // Prevent tooltip from going off-screen
            const rect = tooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) {
                x = pageX - rect.width - 15;
            }
            // For mobile
            if (x < 0) x = 10;
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }
        
        function hideTooltip() {
            tooltip.style.display = 'none';
        }

        // Mouse Events
        document.body.addEventListener('mouseover', e => {
            const trigger = e.target.closest('.tooltip-trigger');
            if (trigger) showTooltip(trigger, e.pageX, e.pageY);
        });

        document.body.addEventListener('mousemove', e => {
            const trigger = e.target.closest('.tooltip-trigger');
            if (trigger) positionTooltip(e.pageX, e.pageY);
        });

        document.body.addEventListener('mouseout', e => {
            const trigger = e.target.closest('.tooltip-trigger');
            if (trigger) hideTooltip();
        });
        
        // Touch Events for Mobile
        document.body.addEventListener('touchstart', e => {
            const trigger = e.target.closest('.tooltip-trigger');
            if (trigger) {
                // Prevent default to stop click if it's purely a tooltip element
                if (trigger.tagName !== 'A' && trigger.tagName !== 'BUTTON') {
                    e.preventDefault();
                }
                const touch = e.touches[0];
                showTooltip(trigger, touch.pageX, touch.pageY);
            } else {
                hideTooltip(); // Tap outside to close
            }
        }, { passive: false });
    }

    // Footer is now integrated into index.html directly.
    // If you add standalone pages, you can either inject it or rely on SPA rendering.

    // Initialize systems
    setupTooltip();

    // Reusable Page Scripts initializer
    window.poe2TimerInterval = null;
    function initPageScripts() {
        // PoE2 Timer
        const timerElement = document.getElementById('league-timer');
        if (window.poe2TimerInterval) {
            clearInterval(window.poe2TimerInterval);
            window.poe2TimerInterval = null;
        }

        if (timerElement) {
            function updateLeagueTimer() {
                const el = document.getElementById('league-timer');
                if (!el) {
                    clearInterval(window.poe2TimerInterval);
                    return;
                }
                const startDate = new Date('2026-05-30T03:00:00+07:00');
                const now = new Date();
                const diffMs = now - startDate;
                
                if (diffMs < 0) {
                    const absDiff = Math.abs(diffMs);
                    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const mins = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
                    const secs = Math.floor((absDiff % (1000 * 60)) / 1000);
                    el.innerHTML = `เหลือเวลาอีก ${days} วัน ${hours} ชั่วโมง ${mins} นาที ${secs} วินาที`;
                } else {
                    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
                    el.innerHTML = `ลีกนี้เริ่มมาได้ ${days} วัน ${hours} ชั่วโมง ${mins} นาที ${secs} วินาที`;
                }
            }
            updateLeagueTimer();
            window.poe2TimerInterval = setInterval(updateLeagueTimer, 1000);
        }
    }
    
    // Run for initial load
    initPageScripts();
    
    // Initial Page Load for SPA
    // Only load if there are no child elements (ignoring text/comments)
    // Actually, for index.html at root, it already has the content.
    // We only load if we are on a subpage and appContent is empty, 
    // or if the user refreshed a subpage (which might be handled by server, or local file open).
    if (appContent && appContent.children.length === 0 && window.location.pathname !== '/' && window.location.pathname !== getBasePath() + '/') {
        const initialPath = window.location.pathname;
        loadPage(initialPath, false);
    }
});
