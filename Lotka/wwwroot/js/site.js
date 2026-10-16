/**
 * LOTKA Global Logistics - Client-side SPA Engine & UI Optimization
 * Seamless Partial Navigation (No Full Reload), Responsive Sidenav, & Dynamic Widgets
 */

(function () {
    'use strict';

    // State & Cache
    let isNavigating = false;

    /* ==========================================================================
       1. Seamless SPA Navigation Engine (Zero Full-Page Reload)
       ========================================================================== */

    function initSpaNavigation() {
        // Intercept all clicks on SPA links
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a.spa-link');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:')) {
                return;
            }

            e.preventDefault();
            navigateTo(href);
        });

        // Handle Browser History Back / Forward
        window.addEventListener('popstate', function () {
            loadPageContent(window.location.pathname, false);
        });
    }

    function navigateTo(url) {
        if (isNavigating) return;
        if (window.location.pathname === url) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            closeSideNav();
            return;
        }

        loadPageContent(url, true);
    }

    async function loadPageContent(url, pushToHistory = true) {
        isNavigating = true;
        const loader = document.getElementById('spa-loader');
        const container = document.getElementById('spa-container');

        if (loader) {
            loader.className = 'spa-loader-bar loading';
        }

        if (container) {
            container.classList.add('spa-fade-out');
        }

        // Close mobile drawer on navigation
        closeSideNav();

        try {
            const response = await fetch(url, {
                headers: {
                    'X-Spa-Request': 'true',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                // If partial fetch fails, fallback to normal navigation
                window.location.href = url;
                return;
            }

            const html = await response.text();

            // Push History
            if (pushToHistory) {
                window.history.pushState(null, '', url);
            }

            // Update DOM content
            if (container) {
                container.innerHTML = html;
                window.scrollTo({ top: 0, behavior: 'instant' });
                setTimeout(() => {
                    container.classList.remove('spa-fade-out');
                }, 50);
            }

            // Update Active Link in Navbar & Drawer
            updateActiveNavLinks(url);

            // Re-initialize dynamic page widgets
            initPageWidgets();

        } catch (err) {
            console.error('SPA Navigation Error:', err);
            window.location.href = url;
        } finally {
            if (loader) {
                loader.className = 'spa-loader-bar complete';
                setTimeout(() => {
                    loader.className = 'spa-loader-bar';
                }, 400);
            }
            isNavigating = false;
        }
    }

    function updateActiveNavLinks(url) {
        const cleanUrl = url.toLowerCase().split('?')[0];

        // Match desktop nav links
        document.querySelectorAll('.lotka-nav-list .nav-link, .mobile-nav-links .mobile-link').forEach(link => {
            const linkHref = (link.getAttribute('href') || '').toLowerCase();
            if (linkHref === cleanUrl || (cleanUrl === '/' && linkHref === '/home/index') || (cleanUrl === '/home' && linkHref === '/home/index')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    /* ==========================================================================
       2. Tablet & Mobile SideNav Drawer Controller
       ========================================================================== */

    function initSideNav() {
        const toggleBtn = document.getElementById('sideNavToggleBtn');
        const closeBtn = document.getElementById('closeDrawerBtn');
        const backdrop = document.getElementById('mobileDrawerBackdrop');
        const drawer = document.getElementById('mobileDrawer');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', function (e) {
                e.preventDefault();
                openSideNav();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                closeSideNav();
            });
        }

        if (backdrop) {
            backdrop.addEventListener('click', function () {
                closeSideNav();
            });
        }

        // Close on ESC key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer && drawer.classList.contains('active')) {
                closeSideNav();
            }
        });
    }

    function openSideNav() {
        const drawer = document.getElementById('mobileDrawer');
        const backdrop = document.getElementById('mobileDrawerBackdrop');
        if (drawer) drawer.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeSideNav() {
        const drawer = document.getElementById('mobileDrawer');
        const backdrop = document.getElementById('mobileDrawerBackdrop');
        if (drawer) drawer.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }

    /* ==========================================================================
       3. Dynamic Interactive Widgets
       ========================================================================== */

    function initPageWidgets() {
        initQuickCalculator();
        initDedicatedCalculator();
        initTrackingForms();
        initContactForm();
        initFaqFilter();
    }

    // Home Page Quick Rate Estimator
    function initQuickCalculator() {
        const calcForm = document.getElementById('quickCalcForm');
        if (!calcForm) return;

        calcForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const origin = document.getElementById('quickOrigin').value;
            const destination = document.getElementById('quickDestination').value;
            const freightType = document.getElementById('quickFreightType').value;
            const weightKg = parseFloat(document.getElementById('quickWeight').value) || 100;

            const resultContainer = document.getElementById('quickCalcResult');
            const summarySpan = document.getElementById('quickCalcSummary');
            const transitSpan = document.getElementById('quickTransitTime');
            const costSpan = document.getElementById('quickEstimatedCost');

            try {
                const response = await fetch('/Home/CalculateQuote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ origin, destination, freightType, weightKg })
                });

                const data = await response.json();
                if (data.success) {
                    summarySpan.textContent = data.summary;
                    transitSpan.textContent = data.transitTime;
                    costSpan.textContent = `${data.estimate.toFixed(2)} AED`;
                    resultContainer.classList.remove('d-none');
                }
            } catch (err) {
                console.error('Rate calculation error:', err);
            }
        });
    }

    // Dedicated /Home/Quote Calculator
    function initDedicatedCalculator() {
        const quoteForm = document.getElementById('dedicatedQuoteForm');
        if (!quoteForm) return;

        async function recomputeDedicatedRate() {
            const origin = document.getElementById('quoteOrigin').value;
            const destination = document.getElementById('quoteDestination').value;
            const weightKg = parseFloat(document.getElementById('quoteWeight').value) || 100;
            const freightTypeInput = document.querySelector('input[name="freightType"]:checked');
            const freightType = freightTypeInput ? freightTypeInput.value : 'Ocean';

            try {
                const response = await fetch('/Home/CalculateQuote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ origin, destination, freightType, weightKg })
                });

                const data = await response.json();
                if (data.success) {
                    const priceDisplay = document.getElementById('quoteDisplayPrice');
                    const summaryDisplay = document.getElementById('quoteDisplaySummary');
                    const transitDisplay = document.getElementById('quoteDisplayTransit');

                    if (priceDisplay) priceDisplay.textContent = `AED ${data.estimate.toFixed(2)}`;
                    if (summaryDisplay) summaryDisplay.textContent = data.summary;
                    if (transitDisplay) transitDisplay.textContent = data.transitTime;
                }
            } catch (err) {
                console.error('Dedicated quote calc error:', err);
            }
        }

        quoteForm.addEventListener('submit', function (e) {
            e.preventDefault();
            recomputeDedicatedRate();
        });

        // Live update on radio mode change or weight change
        document.querySelectorAll('input[name="freightType"]').forEach(r => {
            r.addEventListener('change', recomputeDedicatedRate);
        });

        const weightInput = document.getElementById('quoteWeight');
        if (weightInput) {
            weightInput.addEventListener('input', recomputeDedicatedRate);
        }
    }

    // Tracking Telemetry Forms
    function initTrackingForms() {
        // Quick track form on home page
        const quickTrackForm = document.getElementById('quickTrackForm');
        if (quickTrackForm) {
            quickTrackForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const trackingId = document.getElementById('quickTrackingInput').value;
                const modalInput = document.getElementById('modalTrackingInput');
                if (modalInput) modalInput.value = trackingId;

                const trackModal = new bootstrap.Modal(document.getElementById('trackShipmentModal'));
                trackModal.show();
                fetchAndDisplayTracking(trackingId);
            });
        }

        // Modal tracking form
        const modalForm = document.getElementById('trackModalForm');
        if (modalForm) {
            modalForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const trackingId = document.getElementById('modalTrackingInput').value;
                fetchAndDisplayTracking(trackingId);
            });
        }

        // Initial modal trigger
        const trackModalEl = document.getElementById('trackShipmentModal');
        if (trackModalEl) {
            trackModalEl.addEventListener('shown.bs.modal', function () {
                const modalInput = document.getElementById('modalTrackingInput');
                const trackingId = modalInput ? modalInput.value : 'LOTKA-8942-DXB';
                fetchAndDisplayTracking(trackingId);
            });
        }
    }

    async function fetchAndDisplayTracking(number) {
        const resultBox = document.getElementById('modalTrackingResult');
        if (!resultBox) return;

        resultBox.innerHTML = '<div class="text-center py-4 text-white-50"><i class="fa-solid fa-spinner fa-spin me-2"></i> Querying satellite telemetry network...</div>';

        try {
            const response = await fetch(`/Home/TrackShipment?number=${encodeURIComponent(number)}`);
            const data = await response.json();

            if (data.success && data.tracking) {
                const t = data.tracking;
                let checkpointsHtml = '';

                t.checkpoints.forEach(cp => {
                    checkpointsHtml += `
                        <div class="d-flex align-items-start gap-3 mb-3">
                            <div class="mt-1">
                                <i class="fa-solid ${cp.isCompleted ? 'fa-circle-check text-success' : 'fa-clock text-white-50'}"></i>
                            </div>
                            <div>
                                <div class="fw-semibold text-white small">${cp.location} &bull; <span class="text-white-50">${cp.timestamp}</span></div>
                                <div class="text-white-50 small">${cp.description}</div>
                            </div>
                        </div>
                    `;
                });

                resultBox.innerHTML = `
                    <div class="p-3 rounded bg-dark border border-secondary mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-success">${t.status}</span>
                            <span class="text-info fw-bold">${t.trackingNumber}</span>
                        </div>
                        <div class="row g-2 small text-white-50">
                            <div class="col-sm-6"><strong>Origin:</strong> ${t.origin}</div>
                            <div class="col-sm-6"><strong>Destination:</strong> ${t.destination}</div>
                            <div class="col-sm-6"><strong>Current Position:</strong> ${t.currentLocation}</div>
                            <div class="col-sm-6"><strong>ETA:</strong> <span class="text-warning">${t.estimatedDelivery}</span></div>
                        </div>
                    </div>
                    <div class="tracking-milestones pt-2">
                        <h6 class="text-white small fw-bold text-uppercase mb-3">Live Corridor Milestones</h6>
                        ${checkpointsHtml}
                    </div>
                `;
            }
        } catch (err) {
            resultBox.innerHTML = '<div class="alert alert-danger small">Failed to load live tracking telemetry.</div>';
        }
    }

    // Contact Form AJAX Handler
    function initContactForm() {
        const contactForm = document.getElementById('contactForm');
        if (!contactForm) return;

        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const name = document.getElementById('contactName').value;
            const email = document.getElementById('contactEmail').value;
            const phone = document.getElementById('contactPhone').value;
            const subject = document.getElementById('contactSubject').value;
            const message = document.getElementById('contactMessage').value;

            const submitBtn = document.getElementById('contactSubmitBtn');
            const alertBox = document.getElementById('contactFormAlert');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.querySelector('.btn-text').classList.add('d-none');
                submitBtn.querySelector('.btn-spinner').classList.remove('d-none');
            }

            try {
                const response = await fetch('/Home/SubmitContact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, phone, subject, message })
                });

                const data = await response.json();

                if (alertBox) {
                    alertBox.className = 'alert alert-success d-block small';
                    alertBox.textContent = data.message;
                }

                contactForm.reset();
            } catch (err) {
                if (alertBox) {
                    alertBox.className = 'alert alert-danger d-block small';
                    alertBox.textContent = 'Submission error. Please email info@lotka.com directly.';
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.querySelector('.btn-text').classList.remove('d-none');
                    submitBtn.querySelector('.btn-spinner').classList.add('d-none');
                }
            }
        });
    }

    // FAQ Keyword Search Filter & Prompt Pills
    function initFaqFilter() {
        const searchInput = document.getElementById('faqSearchInput');
        if (!searchInput) return;

        searchInput.addEventListener('input', function () {
            const query = this.value.toLowerCase().trim();
            const items = document.querySelectorAll('#faqAccordion .accordion-item');

            items.forEach(item => {
                const text = (item.textContent + ' ' + (item.getAttribute('data-tags') || '')).toLowerCase();
                if (!query || text.includes(query)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    window.filterFaqTag = function (tag) {
        const input = document.getElementById('faqSearchInput');
        if (input) {
            input.value = tag;
            input.dispatchEvent(new Event('input'));
        }
    };

    // Benefits Page Human vs AI Switcher
    window.switchBenefitMode = function (mode) {
        const btnHuman = document.getElementById('btnPillHuman');
        const btnAi = document.getElementById('btnPillAi');
        const btnSynergy = document.getElementById('btnPillSynergy');

        const title = document.getElementById('synergyTitle');
        const desc = document.getElementById('synergyDesc');
        const icon = document.getElementById('synergyIcon');

        if (btnHuman) btnHuman.classList.remove('active');
        if (btnAi) btnAi.classList.remove('active');
        if (btnSynergy) btnSynergy.classList.remove('active');

        if (mode === 'human') {
            if (btnHuman) btnHuman.classList.add('active');
            if (title) title.textContent = 'Human Logistics Mastery: Diplomatic & Strategic Weight';
            if (desc) desc.textContent = 'Our licensed shipping veterans negotiate emergency vessel allocations, handle complex Dubai customs disputes, and provide tailored white-glove logistics stewardship.';
            if (icon) icon.innerHTML = '<i class="fa-solid fa-user-tie text-primary"></i>';
        } else if (mode === 'ai') {
            if (btnAi) btnAi.classList.add('active');
            if (title) title.textContent = 'Autonomous AI Engine: Millisecond Multi-Carrier Calculation';
            if (desc) desc.textContent = 'Millions of global shipping rates, live satellite sea coordinates, bunker indices, and HS tariff classifications analyzed in real time with zero latency.';
            if (icon) icon.innerHTML = '<i class="fa-solid fa-robot text-info"></i>';
        } else {
            if (btnSynergy) btnSynergy.classList.add('active');
            if (title) title.textContent = 'The LOTKA Harmony: Human Expertise + Artificial Intelligence';
            if (desc) desc.textContent = 'The unmatched precision of machine learning paired with human empathy, creating a 99.8% on-time delivery record across all multimodal trade corridors.';
            if (icon) icon.innerHTML = '<i class="fa-solid fa-bolt text-danger"></i>';
        }
    };

    // Staff Login Helpers
    window.togglePasswordVisibility = function () {
        const passInput = document.getElementById('staffPasswordInput');
        const icon = document.getElementById('togglePasswordIcon');
        if (!passInput) return;

        if (passInput.type === 'password') {
            passInput.type = 'text';
            if (icon) icon.className = 'fa-regular fa-eye-slash';
        } else {
            passInput.type = 'password';
            if (icon) icon.className = 'fa-regular fa-eye';
        }
    };

    window.handleStaffLoginSubmit = async function () {
        const alertBox = document.getElementById('staffLoginAlert');
        const submitBtn = document.getElementById('staffSubmitBtn');
        const username = document.getElementById('staffEmailInput')?.value?.trim();
        const password = document.getElementById('staffPasswordInput')?.value;
        if (!username || !password) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating...';
        try {
            const response = await fetch('/api/lotka-platform/admin-login', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                credentials: 'same-origin', body: JSON.stringify({username,password})
            });
            if (!response.ok) throw new Error('Authentication failed. Check your credentials.');
            const result = await response.json();
            if (!result.authenticated) throw new Error('Authentication failed.');
            alertBox.className = 'alert alert-success d-block small';
            alertBox.textContent = 'Administrator authentication successful.';
            submitBtn.textContent = 'Authenticated';
        } catch (error) {
            alertBox.className = 'alert alert-danger d-block small';
            alertBox.textContent = error.message || 'Authentication unavailable.';
            submitBtn.textContent = 'Login';
        } finally {submitBtn.disabled = false;}
    };

    // DOM Ready Initialization
    document.addEventListener('DOMContentLoaded', function () {
        initSpaNavigation();
        initSideNav();
        initPageWidgets();
        updateActiveNavLinks(window.location.pathname);
    });

})();
