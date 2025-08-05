// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (mobileMenuToggle && navMenu) {
        mobileMenuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
    }

    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed header
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Header scroll effect
    const header = document.querySelector('.header');
    let lastScrollTop = 0;

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScrollTop = scrollTop;
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.step, .category, .feature, .price-tag');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // Get Started button functionality
    const getStartedButtons = document.querySelectorAll('a[href="#get-started"]');
    getStartedButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            showGetStartedModal();
        });
    });

    // Login button functionality
    const loginButtons = document.querySelectorAll('a[href="#login"]');
    loginButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            showLoginModal();
        });
    });
});

// Get Started Modal
function showGetStartedModal() {
    const modal = createModal('Get Started', `
        <div class="modal-content">
            <h3>Start Your Tax Return</h3>
            <p>Ready to get your tax return sorted? Let's begin with a few quick questions.</p>
            <form id="get-started-form" class="form">
                <div class="form-group">
                    <label for="email">Email address</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="phone">Phone number</label>
                    <input type="tel" id="phone" name="phone" required>
                </div>
                <div class="form-group">
                    <label for="tax-year">Tax year</label>
                    <select id="tax-year" name="tax-year" required>
                        <option value="">Select tax year</option>
                        <option value="2023-24">2023-24</option>
                        <option value="2022-23">2022-23</option>
                        <option value="2021-22">2021-22</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="situation">What describes your situation?</label>
                    <select id="situation" name="situation" required>
                        <option value="">Select your situation</option>
                        <option value="self-employed">Self-employed</option>
                        <option value="freelancer">Freelancer/Contractor</option>
                        <option value="landlord">Landlord</option>
                        <option value="investor">Investor</option>
                        <option value="high-earner">High earner (£150K+)</option>
                        <option value="first-time">First-time filer</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary btn-large">Continue</button>
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `);

    document.getElementById('get-started-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData);
        
        // Simulate form submission
        showSuccessMessage('Thank you! We\'ll be in touch shortly to get your tax return started.');
        closeModal();
    });
}

// Login Modal
function showLoginModal() {
    const modal = createModal('Login', `
        <div class="modal-content">
            <h3>Login to Your Account</h3>
            <p>Access your TaxPro dashboard to view your tax returns and account details.</p>
            <form id="login-form" class="form">
                <div class="form-group">
                    <label for="login-email">Email address</label>
                    <input type="email" id="login-email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="remember">
                        <span class="checkmark"></span>
                        Remember me
                    </label>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn-primary btn-large">Login</button>
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                </div>
                <div class="form-footer">
                    <a href="#forgot-password">Forgot your password?</a>
                </div>
            </form>
        </div>
    `);

    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        // Simulate login
        showSuccessMessage('Login successful! Redirecting to your dashboard...');
        closeModal();
    });
}

// Modal utility functions
function createModal(title, content) {
    const modalHTML = `
        <div class="modal-overlay" id="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" onclick="closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add event listener to close modal when clicking overlay
    document.getElementById('modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return document.getElementById('modal-overlay');
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

function showSuccessMessage(message) {
    const successHTML = `
        <div class="success-message" id="success-message">
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <p>${message}</p>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', successHTML);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        const successMsg = document.getElementById('success-message');
        if (successMsg) {
            successMsg.remove();
        }
    }, 3000);
}

// Add animation classes for scroll effects
const style = document.createElement('style');
style.textContent = `
    .step, .category, .feature, .price-tag {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.6s ease;
    }

    .step.animate-in, .category.animate-in, .feature.animate-in, .price-tag.animate-in {
        opacity: 1;
        transform: translateY(0);
    }

    .header.scrolled {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
    }

    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        animation: fadeIn 0.3s ease forwards;
    }

    @keyframes fadeIn {
        to { opacity: 1; }
    }

    .modal {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        transform: scale(0.9);
        animation: modalIn 0.3s ease forwards;
    }

    @keyframes modalIn {
        to {
            transform: scale(1);
        }
    }

    .modal-header {
        padding: 2rem 2rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .modal-header h2 {
        margin: 0;
        color: #1e293b;
    }

    .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #64748b;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        transition: all 0.3s ease;
    }

    .modal-close:hover {
        background: #f1f5f9;
        color: #1e293b;
    }

    .modal-body {
        padding: 2rem;
    }

    .modal-content h3 {
        margin-bottom: 0.5rem;
        color: #1e293b;
    }

    .modal-content p {
        margin-bottom: 2rem;
        color: #64748b;
    }

    /* Form Styles */
    .form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-group label {
        font-weight: 500;
        color: #374151;
    }

    .form-group input,
    .form-group select {
        padding: 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.3s ease;
    }

    .form-group input:focus,
    .form-group select:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .checkbox-label {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 0.75rem !important;
        cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
        width: auto;
        margin: 0;
    }

    .form-actions {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
    }

    .form-footer {
        text-align: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e2e8f0;
    }

    .form-footer a {
        color: #4f46e5;
        text-decoration: none;
        font-size: 0.9rem;
    }

    .form-footer a:hover {
        text-decoration: underline;
    }

    /* Success Message */
    .success-message {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22c55e;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(34, 197, 94, 0.3);
        z-index: 10001;
        animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    .success-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .success-content i {
        font-size: 1.2rem;
    }

    .success-content p {
        margin: 0;
        font-weight: 500;
    }

    /* Mobile Menu Styles */
    @media (max-width: 768px) {
        .nav-menu {
            position: fixed;
            top: 100%;
            left: 0;
            width: 100%;
            background: white;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            flex-direction: column;
            padding: 2rem;
            gap: 1rem;
            transform: translateY(-100%);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }

        .nav-menu.active {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
        }

        .mobile-menu-toggle.active span:nth-child(1) {
            transform: rotate(45deg) translate(5px, 5px);
        }

        .mobile-menu-toggle.active span:nth-child(2) {
            opacity: 0;
        }

        .mobile-menu-toggle.active span:nth-child(3) {
            transform: rotate(-45deg) translate(7px, -6px);
        }

        .modal {
            width: 95%;
            margin: 1rem;
        }

        .modal-header,
        .modal-body {
            padding: 1.5rem;
        }

        .form-actions {
            flex-direction: column;
        }
    }
`;

document.head.appendChild(style);