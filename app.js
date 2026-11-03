// Firebase configuration from user setup
const firebaseConfig = {
    apiKey: "AIzaSyAVSnqQwwYZmRCD5ejl0aFS4to4Z3SB0tw",
    authDomain: "budgeted-studio.firebaseapp.com",
    projectId: "budgeted-studio",
    storageBucket: "budgeted-studio.firebasestorage.app",
    messagingSenderId: "607316127738",
    appId: "1:607316127738:web:639708a7dd1233c10dfe43"
};

// Initialize Firebase using compat SDK
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize OneSignal Web Push SDK v16
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    const onesignalAppId = localStorage.getItem("onesignal_app_id") || "DEFAULT_ONESIGNAL_APP_ID";
    try {
        await OneSignal.init({
            appId: onesignalAppId,
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true
        });
        console.log("OneSignal Web Push SDK initialized");
    } catch (err) {
        console.warn("OneSignal initialization error:", err);
    }
});

// Register Service Worker for PWA (App installation support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}

// App state variables
let currentUserId = null;
let currentUserDisplayName = "User";
let monthlyBudgetLimit = 1500; // Default monthly budget in GEL
let transactionsList = [];
let categoryChartInstance = null;
let studioObligations = [];
let studioIncomeSources = [];
let studioRecurringIncomes = []; // Array of objects { name: string, amount: number }
let unsubscribeSettings = null;
let obligationsChartInstance = null;

// Global accordion toggle for obligations section
window.toggleObligationsAccordion = function() {
    const bodyEl = document.getElementById("obligations-body");
    const btnEl = document.getElementById("obligations-toggle-btn");
    if (!bodyEl) return;
    const isHidden = bodyEl.classList.contains("hidden");
    if (isHidden) {
        bodyEl.classList.remove("hidden");
        if (btnEl) btnEl.classList.add("open");
        if (typeof renderObligationsDashboard === "function") {
            renderObligationsDashboard();
        }
    } else {
        bodyEl.classList.add("hidden");
        if (btnEl) btnEl.classList.remove("open");
    }
};

// SPA Security & Analytics States
let settingsUnlocked = false;
let currentCalendarDate = new Date();
let selectedCalendarDate = new Date();
let activeAnalyticsFilter = "day"; // "day", "week", "month", "year"
let analyticsTrendChartInstance = null;

// Categories configuration
const categories = {
    expense: [
        { value: "ქირა", label: "ქირა" },
        { value: "ხელფასი", label: "ხელფასი" },
        { value: "კომუნალურები", label: "კომუნალურები" },
        { value: "აპარატურა", label: "აპარატურა/ტექნიკა" },
        { value: "მარკეტინგი", label: "მარკეტინგი" },
        { value: "სხვა ხარჯი", label: "სხვა ხარჯი" }
    ],
    income: [
        { value: "პოდკასტის შემოსავალი", label: "პოდკასტის შემოსავალი" },
        { value: "სტუდიის გაქირავება", label: "სტუდიის გაქირავება" },
        { value: "სპონსორობა", label: "სპონსორობა" },
        { value: "სხვა შემოსავალი", label: "სხვა შემოსავალი" }
    ]
};

// ==========================================================================
// DOM ELEMENTS & EVENT LISTENERS
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Auth UI Elements
    const authScreen = document.getElementById("auth-screen");
    const appScreen = document.getElementById("app-screen");
    const authForm = document.getElementById("auth-form");
    const authEmail = document.getElementById("auth-email");
    const authPassword = document.getElementById("auth-password");
    const authName = document.getElementById("auth-name");
    const authSubmitBtn = document.getElementById("auth-submit-btn");
    const authSwitchLink = document.getElementById("auth-switch-link");
    const authSwitchText = document.getElementById("auth-switch-text");
    const signupFields = document.querySelectorAll(".signup-only");
    const authRevealPasswordBtn = document.getElementById("auth-reveal-password-btn");
    const authPasswordEyeIcon = document.getElementById("auth-password-eye-icon");

    // Header & Logout Elements
    const userNameDisplay = document.getElementById("user-name");
    const userEmailDisplay = document.getElementById("user-email");
    const logoutBtn = document.getElementById("logout-btn");

    // Settings Page UI Elements (previously modal)
    const settingsSaveBtn = document.getElementById("settings-save-exit-btn");
    const settingsBudgetInput = document.getElementById("settings-budget");
    const settingsGeminiKeyInput = document.getElementById("settings-gemini-key");
    const settingsRevealKeyBtn = document.getElementById("settings-reveal-key-btn");
    const revealIcon = document.getElementById("reveal-icon");
    const settingsLogoutBtn = document.getElementById("settings-exit-logout-btn");

    // Settings lists elements
    const settingsObligationsList = document.getElementById("settings-obligations-list");
    const newObName = document.getElementById("new-ob-name");
    const newObAmount = document.getElementById("new-ob-amount");
    const btnAddObligation = document.getElementById("btn-add-obligation");

    const settingsIncomeSourcesList = document.getElementById("settings-income-sources-list");
    const newSourceName = document.getElementById("new-source-name");
    const btnAddSource = document.getElementById("btn-add-source");

    const settingsPartnersList = document.getElementById("settings-partners-list");
    const newPartnerName = document.getElementById("new-partner-name");
    const newPartnerAmount = document.getElementById("new-partner-amount");
    const btnAddPartner = document.getElementById("btn-add-partner");

    // Quick Action Form Elements (Income Modal)
    const incomeForm = document.getElementById("quick-income-form");
    const incAmountInput = document.getElementById("quick-inc-amount");
    const incDateInput = document.getElementById("quick-inc-date");
    const incCategorySelect = document.getElementById("quick-inc-category");
    const incSourceInput = document.getElementById("quick-inc-source");

    // Quick Action Form Elements (Expense Modal)
    const expenseForm = document.getElementById("quick-expense-form");
    const expAmountInput = document.getElementById("quick-exp-amount");
    const expDateInput = document.getElementById("quick-exp-date");
    const expCategorySelect = document.getElementById("quick-exp-category");
    const expDescInput = document.getElementById("quick-exp-desc");

    // Quick Action Modals and Header Buttons
    const btnQuickIncome = document.getElementById("btn-quick-income");
    const btnQuickExpense = document.getElementById("btn-quick-expense");
    const quickIncomeModal = document.getElementById("quick-income-modal");
    const quickExpenseModal = document.getElementById("quick-expense-modal");
    const quickIncomeCloseBtn = document.getElementById("quick-income-close-btn");
    const quickExpenseCloseBtn = document.getElementById("quick-expense-close-btn");

    // AI Input Elements
    const aiTextInput = document.getElementById("ai-text-input");
    const aiSubmitBtn = document.getElementById("ai-submit-btn");
    const aiStatusMsg = document.getElementById("ai-status");
    const btnMic = document.getElementById("ai-mic-btn");
    const micIcon = document.getElementById("mic-icon");

    // Quick Income Modal AI Elements
    const quickIncAiInput = document.getElementById("quick-inc-ai-input");
    const quickIncAiMicBtn = document.getElementById("quick-inc-ai-mic-btn");
    const quickIncMicIcon = document.getElementById("quick-inc-mic-icon");
    const quickIncAiSubmitBtn = document.getElementById("quick-inc-ai-submit-btn");
    const quickIncAiStatus = document.getElementById("quick-inc-ai-status");

    // Quick Expense Modal AI Elements
    const quickExpAiInput = document.getElementById("quick-exp-ai-input");
    const quickExpAiMicBtn = document.getElementById("quick-exp-ai-mic-btn");
    const quickExpMicIcon = document.getElementById("quick-exp-mic-icon");
    const quickExpAiSubmitBtn = document.getElementById("quick-exp-ai-submit-btn");
    const quickExpAiStatus = document.getElementById("quick-exp-ai-status");

    // Export Data Element
    const exportBtn = document.getElementById("btn-export");

    // Notification UI Elements
    const notificationBell = document.getElementById("notification-bell");
    const notificationsModal = document.getElementById("notifications-modal");
    const notificationsCloseBtn = document.getElementById("notifications-close-btn");
    const notificationListEl = document.getElementById("notification-list");
    const notificationBadgeEl = document.getElementById("notification-badge");
    const btnClearNotifications = document.getElementById("btn-clear-notifications");
    const btnEnableNotifications = document.getElementById("btn-enable-notifications");
    const btnResetDb = document.getElementById("btn-reset-db");

    // Load saved settings from LocalStorage
    loadSettings();

    // Default Date inputs to today
    const today = new Date().toISOString().split('T')[0];
    incDateInput.value = today;
    expDateInput.value = today;

    // Make date inputs open calendar picker on click anywhere in the field
    [incDateInput, expDateInput].forEach(input => {
        input.addEventListener("click", () => {
            if (typeof input.showPicker === "function") {
                try {
                    input.showPicker();
                } catch (e) {
                    console.error("showPicker failed:", e);
                }
            }
        });
    });

    // Toggle Sign In / Sign Up modes
    let isSignupMode = false;
    authSwitchLink.addEventListener("click", (e) => {
        e.preventDefault();
        isSignupMode = !isSignupMode;
        if (isSignupMode) {
            authSubmitBtn.textContent = "რეგისტრაცია";
            authSwitchText.textContent = "უკვე გაქვთ ანგარიში?";
            authSwitchLink.textContent = "შედით";
            signupFields.forEach(f => f.classList.remove("hidden"));
            authName.setAttribute("required", "required");
        } else {
            authSubmitBtn.textContent = "შესვლა";
            authSwitchText.textContent = "არ გაქვთ ანგარიში?";
            authSwitchLink.textContent = "დარეგისტრირდით";
            signupFields.forEach(f => f.classList.add("hidden"));
            authName.removeAttribute("required");
        }
    });

    // Auth Password Visibility Toggle
    authRevealPasswordBtn.addEventListener("click", () => {
        if (authPassword.type === "password") {
            authPassword.type = "text";
            authRevealPasswordBtn.innerHTML = '<i data-lucide="eye-off" id="auth-password-eye-icon"></i>';
        } else {
            authPassword.type = "password";
            authRevealPasswordBtn.innerHTML = '<i data-lucide="eye" id="auth-password-eye-icon"></i>';
        }
        if (window.lucide) lucide.createIcons();
    });

    // Handle Authentication Submit (Sign In or Sign Up)
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        const password = authPassword.value;
        const name = authName.value.trim();

        try {
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = "გთხოვთ დაელოდოთ...";

            if (isSignupMode) {
                // Register
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await userCredential.user.updateProfile({ displayName: name || "მომხმარებელი" });
                alert("რეგისტრაცია წარმატებით დასრულდა!");
            } else {
                // Login
                await auth.signInWithEmailAndPassword(email, password);
            }
        } catch (error) {
            console.error("Auth error:", error);
            let message = "მოხდა შეცდომა ავტორიზაციისას: " + error.message;
            if (error.code === "auth/email-already-in-use") message = "ეს ელ.ფოსტა უკვე დაკავებულია.";
            if (error.code === "auth/invalid-credential") message = "ელ.ფოსტა ან პაროლი არასწორია.";
            if (error.code === "auth/weak-password") message = "პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო.";
            alert(message);
        } finally {
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isSignupMode ? "რეგისტრაცია" : "შესვლა";
        }
    });

    // Handle Logout from sidebar or settings
    const handleLogout = () => {
        auth.signOut().then(() => {
            // Success
        }).catch(err => console.error("Logout error:", err));
    };
    logoutBtn.addEventListener("click", handleLogout);
    if (settingsLogoutBtn) settingsLogoutBtn.addEventListener("click", handleLogout);

    // Membership approval is enforced both here and by Firestore Security Rules.
    let unsubscribeMembership = null;
    let authGeneration = 0;
    let financialListenersActive = false;
    const approvalScreen = document.getElementById("approval-screen");
    function stopFinancialListeners() {
        [unsubscribeTransactions, unsubscribeSettings, unsubscribeNotifications].forEach(unsubscribe => {
            if (unsubscribe) unsubscribe();
        });
        unsubscribeTransactions = unsubscribeSettings = unsubscribeNotifications = null;
        financialListenersActive = false;
        settingsUnlocked = false;
        transactionsList = [];
        studioObligations = [];
        studioIncomeSources = [];
        studioRecurringIncomes = [];
        notificationsList = [];
        window.currentObligationsList = [];
        renderTransactionsTable();
        renderNotificationsUI();
        document.querySelectorAll(".modal-overlay").forEach(modal => modal.classList.add("hidden"));
    }
    function showApproval(title, message, email) {
        appScreen.classList.add("hidden");
        authScreen.classList.add("hidden");
        approvalScreen.classList.remove("hidden");
        document.getElementById("approval-title").textContent = title;
        document.getElementById("approval-message").textContent = message;
        document.getElementById("approval-email").textContent = email || "";
    }
    document.getElementById("approval-logout-btn").addEventListener("click", handleLogout);
    document.getElementById("approval-retry-btn").addEventListener("click", () => window.location.reload());
    auth.onAuthStateChanged(async user => {
        const generation = ++authGeneration;
        if (unsubscribeMembership) unsubscribeMembership();
        unsubscribeMembership = null;
        stopFinancialListeners();
        currentUserId = user ? user.uid : null;
        if (!user) {
            approvalScreen.classList.add("hidden");
            authScreen.classList.remove("hidden");
            appScreen.classList.add("hidden");
            authForm.reset();
            return;
        }
        currentUserDisplayName = user.displayName || user.email.split('@')[0];
        userNameDisplay.textContent = currentUserDisplayName;
        userEmailDisplay.textContent = user.email;
        showApproval("წვდომის შემოწმება", "გთხოვთ დაელოდოთ…", user.email);
        const memberRef = db.collection("users").doc(user.uid);
        try {
            await db.runTransaction(async tx => {
                const member = await tx.get(memberRef);
                if (!member.exists) tx.set(memberRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: (user.displayName || user.email.split('@')[0]).slice(0, 100),
                    status: "pending",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            if (generation !== authGeneration) return;
            unsubscribeMembership = memberRef.onSnapshot(snapshot => {
                if (generation !== authGeneration) return;
                const status = snapshot.exists ? snapshot.data().status : "pending";
                if (status === "approved") {
                    approvalScreen.classList.add("hidden");
                    authScreen.classList.add("hidden");
                    appScreen.classList.remove("hidden");
                    if (!financialListenersActive) {
                        financialListenersActive = true;
                        connectFirestore();
                        connectSettingsSync();
                        connectNotificationsSync();
                        handleHashRouting();
                        if (window.lucide) lucide.createIcons();
                    }
                } else {
                    stopFinancialListeners();
                    showApproval(status === "rejected" ? "წვდომა უარყოფილია" : "დადასტურების მოლოდინში",
                        status === "rejected" ? "ადმინისტრატორმა ამ ანგარიშის წვდომა უარყო." :
                        "რეგისტრაცია მიღებულია. მონაცემებზე წვდომას ადმინისტრატორის დადასტურების შემდეგ მიიღებთ.", user.email);
                }
            }, error => {
                stopFinancialListeners();
                showApproval("წვდომა ვერ შემოწმდა", "სცადეთ ხელახლა ან დაუკავშირდით ადმინისტრატორს.", user.email);
                console.error("Membership sync error:", error.code);
            });
        } catch (error) {
            if (generation !== authGeneration) return;
            stopFinancialListeners();
            showApproval("წვდომა ვერ შემოწმდა", "სცადეთ ხელახლა ან დაუკავშირდით ადმინისტრატორს.", user.email);
            console.error("Membership registration error:", error.code);
        }
    });

    // Handle Manual Transaction Submit
    // Handle Manual Income Submit
    // Quick Modals Open / Close Event Listeners
    if (btnQuickIncome && quickIncomeModal) {
        btnQuickIncome.addEventListener("click", () => {
            quickIncomeModal.classList.remove("hidden");
            incDateInput.value = new Date().toISOString().split('T')[0];
        });
    }

    if (btnQuickExpense && quickExpenseModal) {
        btnQuickExpense.addEventListener("click", () => {
            quickExpenseModal.classList.remove("hidden");
            expDateInput.value = new Date().toISOString().split('T')[0];
        });
    }

    if (quickIncomeCloseBtn && quickIncomeModal) {
        quickIncomeCloseBtn.addEventListener("click", () => {
            quickIncomeModal.classList.add("hidden");
        });
    }

    if (quickExpenseCloseBtn && quickExpenseModal) {
        quickExpenseCloseBtn.addEventListener("click", () => {
            quickExpenseModal.classList.add("hidden");
        });
    }

    // Handle Manual Income Submit
    if (incomeForm) {
        incomeForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const amount = parseFloat(incAmountInput.value);
            const category = incCategorySelect.value;
            const date = incDateInput.value;
            const source = incSourceInput.value.trim();

            if (isNaN(amount) || amount <= 0) {
                alert("გთხოვთ შეიყვანოთ სწორი თანხა.");
                return;
            }

            try {
                await db.collection("transactions").add({
                    amount,
                    type: "income",
                    category,
                    description: source,
                    date: new Date(date).getTime(),
                    createdBy: currentUserDisplayName,
                    createdAt: Date.now()
                });
                await addActivityNotification("add", { amount, type: "income", category, description: source });

                // Reset form fields & Close modal
                incAmountInput.value = "";
                incSourceInput.value = "";
                quickIncomeModal.classList.add("hidden");
            } catch (error) {
                console.error("Error adding income transaction:", error);
                alert("შეცდომა ჩაწერისას: " + error.message);
            }
        });
    }

    // Handle Manual Expense Submit
    if (expenseForm) {
        expenseForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const amount = parseFloat(expAmountInput.value);
            const category = expCategorySelect.value;
            const date = expDateInput.value;
            const description = expDescInput.value.trim();

            if (isNaN(amount) || amount <= 0) {
                alert("გთხოვდით შეიყვანოთ სწორი თანხა.");
                return;
            }

            try {
                await db.collection("transactions").add({
                    amount,
                    type: "expense",
                    category,
                    description,
                    date: new Date(date).getTime(),
                    createdBy: currentUserDisplayName,
                    createdAt: Date.now()
                });
                await addActivityNotification("add", { amount, type: "expense", category, description });

                // Reset form fields & Close modal
                expAmountInput.value = "";
                expDescInput.value = "";
                quickExpenseModal.classList.add("hidden");
            } catch (error) {
                console.error("Error adding expense transaction:", error);
                alert("შეცდომა ჩაწერისას: " + error.message);
            }
        });
    }

    // ========================================================================
    // SPA ROUTER LOGIC & VIEW MANAGEMENT
    // ========================================================================

    function handleHashRouting() {
        const hash = window.location.hash || "#dashboard";
        const views = ["dashboard", "transactions", "partners", "analytics", "settings"];

        const activeViewName = hash.replace("#", "");

        // Lock settings automatically if switching away from settings page
        if (activeViewName !== "settings") {
            settingsUnlocked = false;
        }

        // Hide all views, remove active classes
        views.forEach(v => {
            const viewEl = document.getElementById(`view-${v}`);
            if (viewEl) viewEl.classList.add("hidden");

            const navLink = document.getElementById(`nav-${v}`);
            if (navLink) navLink.classList.remove("active");

            const bottomNavLink = document.getElementById(`bottom-nav-${v}`);
            if (bottomNavLink) bottomNavLink.classList.remove("active");
        });

        // Show active view, add active classes
        const activeViewEl = document.getElementById(`view-${activeViewName}`);
        if (activeViewEl) {
            activeViewEl.classList.remove("hidden");
        } else {
            // Fallback to dashboard
            const dashboardEl = document.getElementById("view-dashboard");
            if (dashboardEl) dashboardEl.classList.remove("hidden");
        }

        const activeNavLink = document.getElementById(`nav-${activeViewName}`);
        if (activeNavLink) activeNavLink.classList.add("active");

        const activeBottomNavLink = document.getElementById(`bottom-nav-${activeViewName}`);
        if (activeBottomNavLink) activeBottomNavLink.classList.add("active");

        // Action triggers based on active view
        if (activeViewName === "settings") {
            const lockScreen = document.getElementById("settings-lock-screen");
            const settingsContent = document.getElementById("settings-content");

            if (!settingsUnlocked) {
                // Show lock screen, hide settings details
                if (lockScreen) lockScreen.classList.remove("hidden");
                if (settingsContent) settingsContent.classList.add("hidden");
            } else {
                // Show settings details, hide lock screen
                if (lockScreen) lockScreen.classList.add("hidden");
                if (settingsContent) settingsContent.classList.remove("hidden");

                // Load settings into fields
                settingsBudgetInput.value = monthlyBudgetLimit;
                settingsGeminiKeyInput.value = localStorage.getItem("gemini_api_key") || "";

                // Force reset key reveal state to locked
                settingsGeminiKeyInput.disabled = true;
                settingsGeminiKeyInput.type = "password";
                revealIcon.setAttribute("data-lucide", "lock");
                if (window.lucide) lucide.createIcons();

                renderObligationsList();
                renderIncomeSourcesList();
                renderPartnersList();
                renderAdminTransactionsTable();
            }
        } else if (activeViewName === "partners") {
            renderPartnersDashboard();
        } else if (activeViewName === "analytics") {
            renderCalendar();
            renderSelectedDayTransactions(selectedCalendarDate);
            renderAnalyticsChart();
        } else if (activeViewName === "dashboard") {
            renderObligationsDashboard();
            renderCharts();
        }

        // Re-create icons in active view
        if (window.lucide) lucide.createIcons();
    }

    // Global listener for SPA routing
    window.addEventListener("hashchange", handleHashRouting);

    // Settings Unlock Form Submission
    const settingsUnlockForm = document.getElementById("settings-unlock-form");
    if (settingsUnlockForm) {
        settingsUnlockForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const passwordField = document.getElementById("settings-unlock-password");
            const password = passwordField.value;
            const user = auth.currentUser;

            if (!user) {
                alert("მოქმედება შეუძლებელია: მომხმარებელი არ არის ავტორიზებული.");
                return;
            }

            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            try {
                const btn = document.getElementById("btn-unlock-settings");
                btn.disabled = true;
                btn.textContent = "მოწმდება...";

                await user.reauthenticateWithCredential(credential);

                // Reauth successful! Unlock settings
                settingsUnlocked = true;
                passwordField.value = "";

                // Re-route to trigger view redraw
                handleHashRouting();
            } catch (err) {
                console.error("Settings lock re-authentication failed:", err);
                alert("შეცდომა: პაროლი არასწორია!");
            } finally {
                const btn = document.getElementById("btn-unlock-settings");
                btn.disabled = false;
                btn.textContent = "შესვლა";
            }
        });
    }

    // Reveal/Unlock API Key using Password Re-authentication
    settingsRevealKeyBtn.addEventListener("click", async () => {
        if (settingsGeminiKeyInput.disabled) {
            const password = prompt("გთხოვთ შეიყვანოთ თქვენი ანგარიშის პაროლი გასაღების სანახავად:");
            if (!password) return;

            const user = auth.currentUser;
            if (!user) {
                alert("მომხმარებელი არ არის ავტორიზებული!");
                return;
            }

            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            try {
                settingsRevealKeyBtn.disabled = true;
                await user.reauthenticateWithCredential(credential);

                // Re-authentication successful! Enable and reveal field
                settingsGeminiKeyInput.disabled = false;
                settingsGeminiKeyInput.type = "text";
                revealIcon.setAttribute("data-lucide", "unlock");
                if (window.lucide) lucide.createIcons();
            } catch (err) {
                console.error("Re-authentication failed:", err);
                alert("შეცდომა: პაროლი არასწორია!");
            } finally {
                settingsRevealKeyBtn.disabled = false;
            }
        } else {
            // Lock and hide again
            settingsGeminiKeyInput.disabled = true;
            settingsGeminiKeyInput.type = "password";
            revealIcon.setAttribute("data-lucide", "lock");
            if (window.lucide) lucide.createIcons();
        }
    });

    // Save Settings
    settingsSaveBtn.addEventListener("click", async () => {
        const newBudget = parseFloat(settingsBudgetInput.value);
        const geminiKey = settingsGeminiKeyInput.value.trim();

        if (isNaN(newBudget) || newBudget <= 0) {
            alert("გთხოვთ შეიყვანოთ სწორი ბიუჯეტის ლიმიტი!");
            return;
        }

        try {
            settingsSaveBtn.disabled = true;
            settingsSaveBtn.textContent = "ინახება...";

            // Save Gemini key to LocalStorage (private to device!)
            localStorage.setItem("gemini_api_key", geminiKey);

            // Save shared settings and notify collaborators about real changes.
            const settingsRef = db.collection("settings").doc("studio");
            const previous = await settingsRef.get();
            const previousData = previous.exists ? previous.data() : {};
            studioObligations = studioObligations.map(ob => ({
                ...ob,
                id: ob.id || createObligationId()
            }));
            await settingsRef.set({
                monthlyBudget: newBudget,
                obligations: studioObligations,
                incomeSources: studioIncomeSources,
                recurringIncomes: studioRecurringIncomes
            }, { merge: true });

            const changed = [];
            if (Number(previousData.monthlyBudget) !== newBudget) changed.push("თვიური ბიუჯეტი");
            if (JSON.stringify(previousData.obligations || []) !== JSON.stringify(studioObligations)) changed.push("სავალდებულო ხარჯები");
            if (JSON.stringify(previousData.incomeSources || []) !== JSON.stringify(studioIncomeSources)) changed.push("შემოსავლის წყაროები");
            if (JSON.stringify(previousData.recurringIncomes || []) !== JSON.stringify(studioRecurringIncomes)) changed.push("პარტნიორების შემოსავლები");
            if (changed.length) await addSettingsActivityNotification(changed);
            // Reset API key reveal state on save
            settingsGeminiKeyInput.disabled = true;
            settingsGeminiKeyInput.type = "password";
            revealIcon.setAttribute("data-lucide", "lock");
            if (window.lucide) lucide.createIcons();

            alert("პარამეტრები წარმატებით შეინახა!");

            // Redirect to dashboard
            window.location.hash = "#dashboard";
        } catch (err) {
            console.error("Error saving settings:", err);
            alert("შეცდომა პარამეტრების შენახვისას: " + err.message);
        } finally {
            settingsSaveBtn.disabled = false;
            settingsSaveBtn.textContent = "შენახვა და გამოსვლა";
        }
    });

    // 1. Obligations List Render & Actions (Settings)
    function renderObligationsList() {
        settingsObligationsList.innerHTML = "";
        if (studioObligations.length === 0) {
            settingsObligationsList.innerHTML = '<div style="text-align:center; color:#c4c5cc; padding: 12px 0; font-size: 0.8rem; opacity:0.6;">ვალდებულებები არ არის დამატებული</div>';
            return;
        }

        studioObligations.forEach((ob, idx) => {
            const row = document.createElement("div");
            row.className = "settings-ob-row";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "8px 0";
            row.style.borderBottom = "1px solid var(--border-color)";
            row.innerHTML = `
                <div class="ob-row-info">
                    <span class="ob-row-name" style="color:#ffffff; font-weight:500;">${ob.name}</span>
                    <span class="ob-row-amount" style="color:#e8621a; margin-left:8px; font-weight:600;">₾${ob.amount.toFixed(0)}</span>
                </div>
                <button type="button" class="btn-delete-ob" data-index="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem; padding:0 4px; line-height:1;">&times;</button>
            `;
            settingsObligationsList.appendChild(row);
        });

        settingsObligationsList.querySelectorAll(".btn-delete-ob").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const index = parseInt(e.currentTarget.getAttribute("data-index"));
                studioObligations.splice(index, 1);
                renderObligationsList();
            });
        });
    }

    btnAddObligation.addEventListener("click", () => {
        const name = newObName.value.trim();
        const amount = parseFloat(newObAmount.value);

        if (!name) {
            alert("შეიყვანეთ ვალდებულების სახელი!");
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            alert("შეიყვანეთ სწორი თანხა!");
            return;
        }

        if (studioObligations.some(ob => ob.name.toLowerCase() === name.toLowerCase())) {
            alert("ეს ვალდებულება უკვე არსებობს სიაში!");
            return;
        }

        studioObligations.push({ id: createObligationId(), name, amount });
        newObName.value = "";
        newObAmount.value = "";
        renderObligationsList();
    });

    // 2. Income Sources List Render & Actions (Settings)
    function renderIncomeSourcesList() {
        settingsIncomeSourcesList.innerHTML = "";
        if (studioIncomeSources.length === 0) {
            settingsIncomeSourcesList.innerHTML = '<div style="text-align:center; color:#c4c5cc; padding: 12px 0; font-size: 0.8rem; opacity:0.6;">წყაროები არ არის დამატებული</div>';
            return;
        }

        studioIncomeSources.forEach((src, idx) => {
            const row = document.createElement("div");
            row.className = "settings-ob-row";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "8px 0";
            row.style.borderBottom = "1px solid var(--border-color)";
            row.innerHTML = `
                <div class="ob-row-info">
                    <span class="ob-row-name" style="color:#ffffff; font-weight:500;">${src}</span>
                </div>
                <button type="button" class="btn-delete-source" data-index="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem; padding:0 4px; line-height:1;">&times;</button>
            `;
            settingsIncomeSourcesList.appendChild(row);
        });

        settingsIncomeSourcesList.querySelectorAll(".btn-delete-source").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const index = parseInt(e.currentTarget.getAttribute("data-index"));
                studioIncomeSources.splice(index, 1);
                renderIncomeSourcesList();
            });
        });
    }

    btnAddSource.addEventListener("click", () => {
        const name = newSourceName.value.trim();

        if (!name) {
            alert("შეიყვანეთ წყაროს სახელი!");
            return;
        }

        if (studioIncomeSources.some(src => src.toLowerCase() === name.toLowerCase())) {
            alert("ეს წყარო უკვე არსებობს სიაში!");
            return;
        }

        studioIncomeSources.push(name);
        newSourceName.value = "";
        renderIncomeSourcesList();
    });

    // 3. Recurring Incomes / Partners List Render & Actions (Settings)
    function renderPartnersList() {
        settingsPartnersList.innerHTML = "";
        if (studioRecurringIncomes.length === 0) {
            settingsPartnersList.innerHTML = '<div style="text-align:center; color:#c4c5cc; padding: 12px 0; font-size: 0.8rem; opacity:0.6;">პარტნიორები არ არის დამატებული</div>';
            return;
        }

        studioRecurringIncomes.forEach((p, idx) => {
            const row = document.createElement("div");
            row.className = "settings-ob-row";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "8px 0";
            row.style.borderBottom = "1px solid var(--border-color)";
            row.innerHTML = `
                <div class="ob-row-info">
                    <span class="ob-row-name" style="color:#ffffff; font-weight:500;">${p.name}</span>
                    <span class="ob-row-amount" style="color:#10b981; margin-left:8px; font-weight:600;">₾${p.amount.toFixed(0)}</span>
                </div>
                <button type="button" class="btn-delete-partner" data-index="${idx}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem; padding:0 4px; line-height:1;">&times;</button>
            `;
            settingsPartnersList.appendChild(row);
        });

        settingsPartnersList.querySelectorAll(".btn-delete-partner").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const index = parseInt(e.currentTarget.getAttribute("data-index"));
                studioRecurringIncomes.splice(index, 1);
                renderPartnersList();
            });
        });
    }

    btnAddPartner.addEventListener("click", () => {
        const name = newPartnerName.value.trim();
        const amount = parseFloat(newPartnerAmount.value);

        if (!name) {
            alert("შეიყვანეთ პარტნიორის სახელი!");
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            alert("შეიყვანეთ სწორი თანხა!");
            return;
        }

        if (studioRecurringIncomes.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            alert("ეს პარტნიორი უკვე არსებობს სიაში!");
            return;
        }

        studioRecurringIncomes.push({ name, amount });
        newPartnerName.value = "";
        newPartnerAmount.value = "";
        renderPartnersList();
    });

    // Handle Gemini AI Submit
    aiSubmitBtn.addEventListener("click", handleGeminiAI);
    aiTextInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleGeminiAI();
        }
    });

    // Generic Speech Recognition Setup (Web Speech API)
    let recognition = null;
    let isRecording = false;
    let activeMicConfig = null; // { btn, icon, input, status, callback }

    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Web Speech API is not supported in this browser.");
            [btnMic, quickIncAiMicBtn, quickExpAiMicBtn].forEach(btn => {
                if (btn) btn.style.display = "none";
            });
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = "ka-GE";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isRecording = true;
            if (activeMicConfig) {
                activeMicConfig.btn.classList.add("recording");
                activeMicConfig.icon.setAttribute("data-lucide", "mic-off");
                if (window.lucide) lucide.createIcons();
                if (activeMicConfig.status) {
                    activeMicConfig.status.className = "ai-status-msg loading";
                    activeMicConfig.status.textContent = "გისმენთ... ისაუბრეთ ქართულად";
                    activeMicConfig.status.classList.remove("hidden");
                }
            }
        };

        recognition.onerror = (e) => {
            console.error("Speech recognition error:", e);
            stopRecordingState();
            if (activeMicConfig && activeMicConfig.status) {
                activeMicConfig.status.className = "ai-status-msg error";
                activeMicConfig.status.textContent = "ხმის ამოცნობისას მოხდა შეცდომა.";
            }
        };

        recognition.onend = () => {
            stopRecordingState();
        };

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            if (activeMicConfig) {
                if (activeMicConfig.input) {
                    activeMicConfig.input.value = transcript;
                }
                if (activeMicConfig.status) {
                    activeMicConfig.status.className = "ai-status-msg success";
                    activeMicConfig.status.textContent = `ამოცნობილია: "${transcript}"`;
                }
                if (activeMicConfig.callback) {
                    activeMicConfig.callback();
                }
            }
        };
    }

    function stopRecordingState() {
        isRecording = false;
        if (activeMicConfig) {
            activeMicConfig.btn.classList.remove("recording");
            activeMicConfig.icon.setAttribute("data-lucide", "mic");
            if (window.lucide) lucide.createIcons();
        }
    }

    function toggleRecording(config) {
        if (!recognition) {
            initSpeechRecognition();
        }
        if (!recognition) return;

        if (isRecording) {
            recognition.stop();
        } else {
            activeMicConfig = config;
            try {
                recognition.start();
            } catch (err) {
                console.error("Failed to start recognition:", err);
            }
        }
    }

    // Toggle recording for Dashboard mic
    if (btnMic) {
        btnMic.addEventListener("click", () => {
            toggleRecording({
                btn: btnMic,
                icon: micIcon,
                input: aiTextInput,
                status: aiStatusMsg,
                callback: () => handleGeminiAI()
            });
        });
    }

    // Toggle recording for Quick Income Modal mic
    if (quickIncAiMicBtn) {
        quickIncAiMicBtn.addEventListener("click", () => {
            toggleRecording({
                btn: quickIncAiMicBtn,
                icon: quickIncMicIcon,
                input: quickIncAiInput,
                status: quickIncAiStatus,
                callback: () => handleModalGeminiAI("inc")
            });
        });
    }

    // Toggle recording for Quick Expense Modal mic
    if (quickExpAiMicBtn) {
        quickExpAiMicBtn.addEventListener("click", () => {
            toggleRecording({
                btn: quickExpAiMicBtn,
                icon: quickExpMicIcon,
                input: quickExpAiInput,
                status: quickExpAiStatus,
                callback: () => handleModalGeminiAI("exp")
            });
        });
    }

    // Handle Quick Income Modal AI Submit
    if (quickIncAiSubmitBtn) {
        quickIncAiSubmitBtn.addEventListener("click", () => handleModalGeminiAI("inc"));
    }
    if (quickIncAiInput) {
        quickIncAiInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                handleModalGeminiAI("inc");
            }
        });
    }

    // Handle Quick Expense Modal AI Submit
    if (quickExpAiSubmitBtn) {
        quickExpAiSubmitBtn.addEventListener("click", () => handleModalGeminiAI("exp"));
    }
    if (quickExpAiInput) {
        quickExpAiInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                handleModalGeminiAI("exp");
            }
        });
    }

    // Handle Export to Excel (CSV)
    exportBtn.addEventListener("click", exportTransactionsToCSV);

    // Handle Notifications Modal Toggle and Clear History
    if (notificationBell && notificationsModal) {
        notificationBell.addEventListener("click", () => {
            notificationsModal.classList.remove("hidden");
            // Mark all read locally (to clear notification badge)
            localStorage.setItem("last_read_notification_time", Date.now());
            if (notificationBadgeEl) notificationBadgeEl.classList.add("hidden");
            renderNotificationsUI();
        });
    }

    if (notificationsCloseBtn && notificationsModal) {
        notificationsCloseBtn.addEventListener("click", () => {
            notificationsModal.classList.add("hidden");
        });
    }

    if (notificationsModal) {
        notificationsModal.addEventListener("click", (e) => {
            if (e.target === notificationsModal) {
                notificationsModal.classList.add("hidden");
            }
        });
    }

    if (btnClearNotifications) {
        btnClearNotifications.addEventListener("click", async () => {
            if (confirm("ნამდვილად გსურთ შეტყობინებების ისტორიის სრულად წაშლა?")) {
                try {
                    btnClearNotifications.disabled = true;
                    btnClearNotifications.textContent = "იშლება...";

                    const snapshot = await db.collection("notifications").get();
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();

                    if (notificationsModal) notificationsModal.classList.add("hidden");
                } catch (err) {
                    console.error("Failed to clear notifications:", err);
                    alert("შეცდომა გასუფთავებისას: " + err.message);
                } finally {
                    btnClearNotifications.disabled = false;
                    btnClearNotifications.textContent = "გასუფთავება";
                }
            }
        });
    }

    // Configure Notification Enable button
    if (btnEnableNotifications) {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            btnEnableNotifications.textContent = "✅ შეტყობინებები ჩართულია";
            btnEnableNotifications.disabled = true;
            btnEnableNotifications.style.opacity = "0.7";
            btnEnableNotifications.style.cursor = "default";
        }

        btnEnableNotifications.addEventListener("click", async () => {
            if (typeof Notification !== "undefined") {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    btnEnableNotifications.textContent = "✅ შეტყობინებები ჩართულია";
                    btnEnableNotifications.disabled = true;
                    btnEnableNotifications.style.opacity = "0.7";
                    btnEnableNotifications.style.cursor = "default";
                    triggerWebNotification("Budgeted Studio", "შეტყობინებები წარმატებით გააქტიურდა!");
                }
            }
        });
    }

    // Reset Database Click Handler
    if (btnResetDb) {
        btnResetDb.addEventListener("click", async () => {
            if (confirm("ნამდვილად გსურთ ბაზის განულება? ყველანაირი სატესტო შემოსავალი, გასავალი და შეტყობინება წაიშლება!")) {
                try {
                    btnResetDb.disabled = true;
                    btnResetDb.textContent = "იშლება...";

                    // 1. Delete all transactions
                    const transactionsSnap = await db.collection("transactions").get();
                    const txBatch = db.batch();
                    transactionsSnap.forEach(doc => {
                        txBatch.delete(doc.ref);
                    });
                    await txBatch.commit();
                    console.log("All transactions deleted.");

                    // 2. Delete all notifications
                    const notificationsSnap = await db.collection("notifications").get();
                    const notifBatch = db.batch();
                    notificationsSnap.forEach(doc => {
                        notifBatch.delete(doc.ref);
                    });
                    await notifBatch.commit();
                    console.log("All notifications deleted.");

                    // UI Triggers & Dashboard refresh (usually auto-triggered by snapshot but good to have)
                    updateSummary();
                    renderTransactionsTable();
                    renderCharts();
                    if (typeof renderObligationsDashboard === "function") {
                        renderObligationsDashboard();
                    }

                    alert("ბაზა წარმატებით განულდა!");
                } catch (err) {
                    console.error("Error resetting database:", err);
                    alert("შეცდომა განულებისას: " + err.message);
                } finally {
                    btnResetDb.disabled = false;
                    btnResetDb.textContent = "⚠️ ბაზის სრული განულებით";
                }
            }
        });
    }

    // ========================================================================
    // CALENDAR & ANALYTICS EVENTS (inside DOMContentLoaded)
    // ========================================================================

    const prevMonthBtn = document.getElementById("calendar-prev-month-btn");
    const nextMonthBtn = document.getElementById("calendar-next-month-btn");

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // Interval filters
    document.querySelectorAll(".btn-filter").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            activeAnalyticsFilter = e.currentTarget.getAttribute("data-filter");
            renderAnalyticsChart();
        });
    });

    // Edit Transaction Modal Close
    const editModalCloseBtn = document.getElementById("edit-modal-close-btn");
    const editModal = document.getElementById("edit-transaction-modal");
    if (editModalCloseBtn && editModal) {
        editModalCloseBtn.addEventListener("click", () => {
            editModal.classList.add("hidden");
        });
    }

    // Edit Transaction Submit
    const editTxForm = document.getElementById("edit-transaction-form");
    if (editTxForm) {
        editTxForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit-tx-id").value;
            const amount = parseFloat(document.getElementById("edit-tx-amount").value);
            const date = new Date(document.getElementById("edit-tx-date").value).getTime();
            const category = document.getElementById("edit-tx-category").value;
            const description = document.getElementById("edit-tx-desc").value.trim();

            if (isNaN(amount) || amount <= 0) {
                alert("შეიყვანეთ სწორი თანხა!");
                return;
            }

            try {
                const submitBtn = editTxForm.querySelector("button[type='submit']");
                submitBtn.disabled = true;
                submitBtn.textContent = "ინახება...";

                await db.collection("transactions").doc(id).update({
                    amount,
                    date,
                    category,
                    description
                });

                const type = document.getElementById("edit-tx-type").value;
                await addActivityNotification("update", { amount, type, category, description });

                editModal.classList.add("hidden");
                // Reload admin table
                renderAdminTransactionsTable();
            } catch (err) {
                console.error("Error updating transaction:", err);
                alert("შეცდომა განახლებისას: " + err.message);
            } finally {
                const submitBtn = editTxForm.querySelector("button[type='submit']");
                submitBtn.disabled = false;
                submitBtn.textContent = "ცვლილებების შენახვა";
            }
        });
    }

    // Obligations Collapsible Toggle is handled via window.toggleObligationsAccordion()

    // Global Event Delegation for Pay Obligation buttons (handles both desktop click and mobile touch)
    document.addEventListener("click", function(e) {
        const btn = e.target.closest(".btn-pay-obligation");
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            const idx = btn.getAttribute("data-ob-index");
            if (idx !== null && typeof window.openPayObligationModalByIndex === "function") {
                window.openPayObligationModalByIndex(parseInt(idx, 10));
            }
        }
    });

    // Pay Obligation Modal Cancel Button
    const payCancelBtn = document.getElementById("pay-obligation-cancel-btn");
    const payModal = document.getElementById("pay-obligation-modal");
    if (payCancelBtn && payModal) {
        payCancelBtn.addEventListener("click", () => {
            payModal.classList.add("hidden");
            pendingObligationPayment = null;
        });
    }

    // Pay Obligation Modal Confirm Button
    const payConfirmBtn = document.getElementById("pay-obligation-confirm-btn");
    if (payConfirmBtn) {
        payConfirmBtn.addEventListener("click", async () => {
            await executeObligationPayment();
        });
    }
});

// Load configurations from local storage
function loadSettings() {
    const savedBudget = localStorage.getItem("monthly_budget");
    if (savedBudget) {
        monthlyBudgetLimit = parseFloat(savedBudget);
    }
}

// ==========================================================================
// FIRESTORE SYNC & DATA CALCULATION
// ==========================================================================

let unsubscribeTransactions = null;
let pendingObligationPayment = null;

// Automatic generation disabled: user manually confirms and deducts obligations with one click
async function checkAndGenerateMandatoryExpenses() {
    // Disabled as requested. Expenses are paid manually via obligations section with confirmation.
    return;
}

function connectFirestore() {
    // If listener already exists, unsubscribe first
    if (unsubscribeTransactions) unsubscribeTransactions();

    const transactionsQuery = db.collection("transactions").orderBy("date", "desc");

    // Setup real-time updates listener
    unsubscribeTransactions = transactionsQuery.onSnapshot((snapshot) => {
        transactionsList = [];
        snapshot.forEach((docSnap) => {
            transactionsList.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        checkAndGenerateMandatoryExpenses();
        updateSummary();
        renderTransactionsTable();
        renderCharts();
        renderObligationsDashboard();
        renderPartnersDashboard();
    }, (error) => {
        console.error("Firestore sync error:", error);
    });
}

// Calculate totals and update overview cards
function updateSummary() {
    let totalExpense = 0;
    let totalIncome = 0;

    transactionsList.forEach(tx => {
        if (tx.type === "expense") {
            totalExpense += tx.amount;
        } else if (tx.type === "income") {
            totalIncome += tx.amount;
        }
    });

    // Calculate current month's start and end timestamps for obligations tracking
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1).getTime();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).getTime();

    // Calculate current month's expenses for budget progress bar
    let currentMonthExpense = 0;
    transactionsList.forEach(tx => {
        const txDate = new Date(tx.date);
        if (tx.type === "expense" && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
            currentMonthExpense += tx.amount;
        }
    });

    // Monthly obligation allocation is a projection, not an expense transaction.
    // It becomes active on the second day, including when the app was closed then.
    const monthlyObligations = now.getDate() >= 2
        ? studioObligations.reduce((sum, ob) => sum + (Number(ob.amount) || 0), 0)
        : 0;
    const monthTransactions = transactionsList.filter(tx => tx.date >= startOfMonth && tx.date <= endOfMonth);
    const monthIncome = monthTransactions.reduce((sum, tx) => sum + (tx.type === "income" ? Number(tx.amount) || 0 : 0), 0);
    const extraExpense = monthTransactions.reduce((sum, tx) => sum + (
        tx.type === "expense" && !tx.isMandatory && tx.category !== "სავალდებულო ხარჯი"
            ? Number(tx.amount) || 0 : 0
    ), 0);
    const remainingObligations = Math.max(0, monthlyObligations - monthIncome);
    const displayedExpense = remainingObligations > 0 ? remainingObligations : -extraExpense;
    const displayedIncome = monthIncome - monthlyObligations;
    const netBalance = Math.max(0, monthIncome - monthlyObligations - extraExpense);

    // Format display values
    document.getElementById("total-expense").textContent = `₾${displayedExpense.toFixed(2)}`;
    document.getElementById("total-income").textContent = `₾${displayedIncome.toFixed(2)}`;

    const balanceEl = document.getElementById("net-balance");
    const balanceIconContainer = document.getElementById("balance-icon-container");
    const balanceSubtitle = document.getElementById("balance-subtitle");

    balanceEl.textContent = `₾${netBalance.toFixed(2)}`;

    // Update balance colors and subtitles based on net balance value
    if (netBalance >= 0) {
        balanceEl.style.color = "var(--success-green)";
        balanceSubtitle.textContent = "წმინდა მოგება (სავალდებულო ხარჯების ჩათვლით)";
        balanceIconContainer.className = "card-icon income-icon";
        balanceIconContainer.innerHTML = '<i data-lucide="arrow-up-right"></i>';
    } else {
        balanceEl.style.color = "var(--danger-red)";
        balanceSubtitle.textContent = "მოსალოდნელი გასავლების გათვალისწინებით (მინუსი)";
        balanceIconContainer.className = "card-icon expense-icon";
        balanceIconContainer.innerHTML = '<i data-lucide="arrow-down-right"></i>';
    }

    // Budget status calculation based on current month's expenses
    const budgetPct = Math.min((currentMonthExpense / monthlyBudgetLimit) * 100, 100);
    const budgetProgressBar = document.getElementById("budget-progress-bar");
    const budgetPercentageText = document.getElementById("budget-percentage");
    const budgetDetailText = document.getElementById("budget-detail");

    budgetProgressBar.style.width = `${budgetPct}%`;
    budgetPercentageText.textContent = `${Math.round((currentMonthExpense / monthlyBudgetLimit) * 100)}%`;
    budgetDetailText.textContent = `₾${currentMonthExpense.toFixed(2)} / ₾${monthlyBudgetLimit.toFixed(2)}`;

    if (currentMonthExpense > monthlyBudgetLimit) {
        budgetProgressBar.style.background = "var(--danger-gradient)";
    } else {
        budgetProgressBar.style.background = "var(--accent-gradient)";
    }

    // Refresh icons inside UI
    if (window.lucide) lucide.createIcons();
}

// Render list of transactions in the main tables (Read-Only)
function renderTransactionsTable() {
    const incomeListBody = document.getElementById("income-transactions-list");
    const expenseListBody = document.getElementById("expense-transactions-list");
    const noIncomeTx = document.getElementById("no-income-transactions");
    const noExpenseTx = document.getElementById("no-expense-transactions");

    if (!incomeListBody || !expenseListBody) return;

    incomeListBody.innerHTML = "";
    expenseListBody.innerHTML = "";

    const incomeTransactions = transactionsList.filter(tx => tx.type === "income");
    const expenseTransactions = transactionsList.filter(tx => tx.type === "expense");

    // Income rendering
    if (incomeTransactions.length === 0) {
        noIncomeTx.classList.remove("hidden");
    } else {
        noIncomeTx.classList.add("hidden");
        incomeTransactions.forEach(tx => {
            const tr = document.createElement("tr");
            const dateStr = new Date(tx.date).toLocaleDateString('ka-GE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${tx.description || "-"}</td>
                <td>${tx.category}</td>
                <td><span class="user-display-name">${tx.createdBy || "სტუმარი"}</span></td>
                <td class="table-amount income">+₾${tx.amount.toFixed(2)}</td>
            `;
            incomeListBody.appendChild(tr);
        });
    }

    // Expense rendering
    if (expenseTransactions.length === 0) {
        noExpenseTx.classList.remove("hidden");
    } else {
        noExpenseTx.classList.add("hidden");
        expenseTransactions.forEach(tx => {
            const tr = document.createElement("tr");
            const dateStr = new Date(tx.date).toLocaleDateString('ka-GE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const typeBadge = tx.isMandatory
                ? `<span class="badge badge-mandatory">სავალდებულო</span>`
                : `<span class="badge badge-regular">ჩვეულებრივი</span>`;

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${tx.description || "-"}</td>
                <td>${tx.category}</td>
                <td>${typeBadge}</td>
                <td><span class="user-display-name">${tx.createdBy || "სტუმარი"}</span></td>
                <td class="table-amount expense">-₾${tx.amount.toFixed(2)}</td>
            `;
            expenseListBody.appendChild(tr);
        });
    }

    if (window.lucide) lucide.createIcons();
}

// Export data function
function exportTransactionsToCSV() {
    if (transactionsList.length === 0) {
        alert("საექსპორტო მონაცემები არ არის.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "თარიღი,ტიპი,კატეგორია,მიზნობრიობა / აღწერა,შემტანი,თანხა (₾)\n";

    transactionsList.forEach(tx => {
        const dateStr = new Date(tx.date).toISOString().split('T')[0];
        const typeText = tx.type === "expense" ? "გასავალი" : "შემოსავალი";
        const cleanDesc = (tx.description || "").replace(/"/g, '""');

        csvContent += `"${dateStr}","${typeText}","${tx.category}","${cleanDesc}","${tx.createdBy}",${tx.amount.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `budgeted_studio_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// CHARTS RENDERING (Chart.js)
// ==========================================================================

function renderCharts() {
    // 1. Doughnut Chart (Categories of expenses)
    const expenseCategoriesData = {};
    categories.expense.forEach(c => expenseCategoriesData[c.value] = 0);

    transactionsList.forEach(tx => {
        if (tx.type === "expense") {
            expenseCategoriesData[tx.category] = (expenseCategoriesData[tx.category] || 0) + tx.amount;
        }
    });

    const doughnutLabels = Object.keys(expenseCategoriesData);
    const doughnutValues = Object.values(expenseCategoriesData);
    const hasExpenses = doughnutValues.some(val => val > 0);

    const ctxCategory = document.getElementById("categoryChart").getContext("2d");

    if (categoryChartInstance) categoryChartInstance.destroy();

    if (!hasExpenses) {
        categoryChartInstance = new Chart(ctxCategory, {
            type: 'doughnut',
            data: {
                labels: ['ხარჯი არ არის'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#27272a'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#a1a1aa' } }
                }
            }
        });
    } else {
        categoryChartInstance = new Chart(ctxCategory, {
            type: 'doughnut',
            data: {
                labels: doughnutLabels,
                datasets: [{
                    data: doughnutValues,
                    backgroundColor: [
                        '#6366f1', // Indigo
                        '#8b5cf6', // Violet
                        '#ec4899', // Pink
                        '#f43f5e', // Rose
                        '#f59e0b', // Amber
                        '#06b6d4'  // Cyan
                    ],
                    borderColor: '#18181b',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#a1a1aa', font: { family: 'Inter' } } },
                },
                cutout: '65%'
            }
        });
    }

    // 2. Trend Chart has been moved to the Analytics page, so we only handle Category chart on Dashboard.
}

// ==========================================================================
// GEMINI AI INTEGRATION (Smart Input parsing)
// ==========================================================================

// Corrected handleGeminiAI() function
async function handleGeminiAI() {
    const aiTextInput = document.getElementById("ai-text-input");
    const aiStatusMsg = document.getElementById("ai-status");
    const text = aiTextInput.value.trim();

    if (!text) {
        aiStatusMsg.className = "ai-status-msg error";
        aiStatusMsg.textContent = "შეცდომა: გთხოვთ შეიყვანოთ ტექსტი!";
        aiStatusMsg.classList.remove("hidden");
        return;
    }

    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
        aiStatusMsg.className = "ai-status-msg error";
        aiStatusMsg.textContent = "შეცდომა: Gemini API გასაღები ვერ მოიძებნა. გთხოვთ შეიყვანოთ იგი პარამეტრებიდან.";
        aiStatusMsg.classList.remove("hidden");
        window.location.hash = "#settings";
        return;
    }

    try {
        aiStatusMsg.className = "ai-status-msg loading";
        aiStatusMsg.textContent = "Gemini აანალიზებს ტექსტს...";
        aiStatusMsg.classList.remove("hidden");

        const todayDate = new Date().toISOString().split('T')[0];

        const prompt = `You are a financial parsing assistant. The current date is ${todayDate}. Parse the following Georgian text. Transaction description: "${text}". Return ONLY a JSON object with fields: { "type": "expense" or "income", "amount": number (positive float), "category": string (match categories), "description": string, "date": string in YYYY-MM-DD format }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            if (response.status === 429 || response.status === 503) {
                const fallbackResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                handleApiResponse(fallbackResponse, aiStatusMsg);
                return;
            } else {
                aiStatusMsg.className = "ai-status-msg error";
                aiStatusMsg.textContent = `შეცდომა: API დაბრუნებულია სტატუსით ${response.status}`;
                return;
            }
        }

        const data = await response.json();
        handleApiResponse(data, aiStatusMsg);

    } catch (err) {
        console.error("Gemini AI error:", err);
        aiStatusMsg.className = "ai-status-msg error";
        aiStatusMsg.textContent = "ტექსტის დამუშავებისას მოხდა შეცდომა. შეამოწმეთ API გასაღები ან ინტერნეტ კავშირი.";
    }
}

// Corrected handleModalGeminiAI() function
async function handleModalGeminiAI(type) {
    const inputEl = document.getElementById(`quick-${type}-ai-input`);
    const statusEl = document.getElementById(`quick-${type}-ai-status`);
    const text = inputEl.value.trim();

    if (!text) {
        statusEl.className = "ai-status-msg error";
        statusEl.textContent = "შეცდომა: გთხოვთ შეიყვანოთ ტექსტი!";
        statusEl.classList.remove("hidden");
        return;
    }

    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
        statusEl.className = "ai-status-msg error";
        statusEl.textContent = "შეცდომა: Gemini API გასაღები ვერ მოიძებნა. შეიყვანეთ იგი პარამეტრებიდან.";
        statusEl.classList.remove("hidden");
        return;
    }

    try {
        statusEl.className = "ai-status-msg loading";
        statusEl.textContent = "Gemini აანალიზებს ტექსტს...";
        statusEl.classList.remove("hidden");

        const todayDate = new Date().toISOString().split('T')[0];

        const prompt = `You are a financial parsing assistant. The current date is ${todayDate}. Parse the following Georgian text. Transaction description: "${text}". Return ONLY a JSON object with fields: { "amount": number (positive float), "category": string (match categories), "description": string, "date": string in YYYY-MM-DD format }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            if (response.status === 429 || response.status === 503) {
                const fallbackResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                handleModalApiResponse(fallbackResponse, statusEl);
                return;
            } else {
                statusEl.className = "ai-status-msg error";
                statusEl.textContent = `შეცდომა: API დაბრუნებულია სტატუსით ${response.status}`;
                return;
            }
        }

        const data = await response.json();
        handleModalApiResponse(data, statusEl);

    } catch (err) {
        console.error("Gemini AI error:", err);
        statusEl.className = "ai-status-msg error";
        statusEl.textContent = "ტექსტის დამუშავებისას მოხდა შეცდომა.";
    }
}

// ==========================================================================
// OBLIGATIONS RETRIEVAL, SYNC & RENDERING
// ==========================================================================

function connectSettingsSync() {
    if (unsubscribeSettings) unsubscribeSettings();
    
    unsubscribeSettings = db.collection("settings").doc("studio").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.monthlyBudget !== undefined) {
                monthlyBudgetLimit = parseFloat(data.monthlyBudget);
                const budgetInput = document.getElementById("settings-budget");
                if (budgetInput) budgetInput.value = monthlyBudgetLimit;
            }
            if (data.obligations !== undefined) {
                studioObligations = data.obligations || [];
            } else {
                studioObligations = [];
            }
            if (data.incomeSources !== undefined) {
                studioIncomeSources = data.incomeSources || [];
            } else {
                studioIncomeSources = [];
            }
            if (data.recurringIncomes !== undefined) {
                studioRecurringIncomes = data.recurringIncomes || [];
            } else {
                studioRecurringIncomes = [];
            }
        } else {
            // Document doesn't exist, create it with default budget
            db.collection("settings").doc("studio").set({
                monthlyBudget: 1500,
                obligations: [],
                incomeSources: [],
                recurringIncomes: []
            }).catch(err => console.error("Error creating default settings:", err));
        }
        
        // Re-render UI and charts with the updated settings
        checkAndGenerateMandatoryExpenses();
        updateSummary();
        
        // Trigger rendering of lists if settings view is active
        if (window.location.hash === "#settings") {
            const renderListContainer = document.getElementById("settings-obligations-list");
            if (renderListContainer && typeof renderObligationsList === 'function') {
                renderObligationsList();
            }
            const renderSourceListContainer = document.getElementById("settings-income-sources-list");
            if (renderSourceListContainer && typeof renderIncomeSourcesList === 'function') {
                renderIncomeSourcesList();
            }
            const renderPartnersListContainer = document.getElementById("settings-partners-list");
            if (renderPartnersListContainer && typeof renderPartnersList === 'function') {
                renderPartnersList();
            }
        } else if (window.location.hash === "#partners") {
            renderPartnersDashboard();
        }
        
        // Update Datalist on Dashboard
        renderIncomeSourcesDatalist();
        
        renderObligationsDashboard();
    }, (error) => {
        console.error("Settings sync error:", error);
    });
}

function renderIncomeSourcesDatalist() {
    const datalist = document.getElementById("income-sources-list");
    if (!datalist) return;
    
    datalist.innerHTML = "";
    studioIncomeSources.forEach(src => {
        const option = document.createElement("option");
        option.value = src;
        datalist.appendChild(option);
    });
}

function renderObligationsDashboard() {
    const checklistContainer = document.getElementById("obligations-checklist");
    const canvas = document.getElementById("obligationsChart");
    const summaryBadge = document.getElementById("obligations-summary-badge");
    
    if (!checklistContainer || !canvas) return;
    
    // Clear checklist
    checklistContainer.innerHTML = "";
    
    if (studioObligations.length === 0) {
        if (summaryBadge) summaryBadge.textContent = "0";
        checklistContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding: 40px 0; color:var(--text-secondary); opacity:0.6; width:100%;">
                <i data-lucide="info" style="width:32px; height:32px; margin-bottom:8px; color:#e8621a;"></i>
                <p style="font-size:0.9rem; font-weight:500;">სავალდებულო ხარჯები არ არის ჩაწერილი.</p>
                <p style="font-size:0.75rem; margin-top:4px; font-weight:300;">მათი დამატება შეგიძლიათ პარამეტრებიდან.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        
        if (obligationsChartInstance) {
            obligationsChartInstance.destroy();
            obligationsChartInstance = null;
        }
        return;
    }
    
    // 1. Check which obligations have already been paid (recorded as expense) in the current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const currentMonthExpenses = transactionsList.filter(t => {
        if (t.type !== "expense") return false;
        const tDate = new Date(t.date);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    let totalObligationsAmount = 0;
    let totalPaidObligationsAmount = 0;
    let unpaidCount = 0;

    const obDetails = studioObligations.map(ob => {
        totalObligationsAmount += ob.amount;
        
        const legacyNameKey = ob.name.trim().toLowerCase().replace(/\s+/g, "-");
        const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
        const matchingTx = currentMonthExpenses.find(t => t.isMandatory === true && (
            (ob.id && t.obligationId === ob.id) ||
            (!ob.id && t.obligationPaymentKey === `${monthKey}_${legacyNameKey}`)
        ));

        const isPaid = !!matchingTx;
        const paidAmount = isPaid ? Number(matchingTx.amount) : 0;
        totalPaidObligationsAmount += paidAmount;
        if (!isPaid) unpaidCount++;

        return {
            id: ob.id || null,
            name: ob.name,
            amount: ob.amount,
            target: ob.amount,
            isPaid: isPaid
        };
    });

    if (summaryBadge) {
        summaryBadge.textContent = unpaidCount > 0 
            ? `${unpaidCount} გადასახდელი` 
            : `ყველა დაფარულია`;
        summaryBadge.style.color = unpaidCount > 0 ? "#ef4444" : "#10b981";
        summaryBadge.style.background = unpaidCount > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)";
    }
    
    const totalUnpaidObligationsAmount = Math.max(0, totalObligationsAmount - totalPaidObligationsAmount);
    window.currentObligationsList = obDetails;
    
    // 2. Render Checklist items with Pay buttons
    obDetails.forEach((ob, index) => {
        const item = document.createElement("div");
        item.className = `ob-item ${ob.isPaid ? 'paid' : 'pending'}`;
        
        const actionHtml = ob.isPaid 
            ? `<span class="ob-status-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 12px; font-size: 0.75rem; border-radius: 4px; font-weight: 600;">✅ გადახდილია</span>`
            : `<div style="display: flex; align-items: center; gap: 8px;">
                   <span class="ob-status-badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 5px 8px; font-size: 0.7rem; border-radius: 4px; font-weight: 600;">გადასახდელი</span>
                   <button type="button" class="btn btn-pay-obligation" data-ob-index="${index}" style="background: #ef4444; color: #fff; padding: 6px 14px; font-weight: 600; font-size: 0.78rem; border-radius: 4px; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);">
                       <i data-lucide="credit-card" style="width: 14px; height: 14px;"></i> გადახდა
                   </button>
               </div>`;
        
        item.innerHTML = `
            <div class="ob-name-wrapper">
                <span class="ob-name" style="font-weight: 600; font-size: 0.95rem;">${ob.name}</span>
                <span class="ob-progress-text" style="color: ${ob.isPaid ? '#10b981' : '#ef4444'}; font-weight: 500;">
                    ${ob.isPaid ? '✓ მიმდინარე თვის ხარჯი გატარებულია' : '⚠️ ჯერ არ არის გადახდილი'}
                </span>
            </div>
            <div class="ob-amount-wrapper">
                <span class="ob-amount" style="font-size: 1.3rem; font-weight: 700; color: ${ob.isPaid ? '#ffffff' : '#f87171'};">₾${ob.target.toFixed(0)}</span>
                ${actionHtml}
            </div>
        `;

        checklistContainer.appendChild(item);
    });
    
    if (window.lucide) lucide.createIcons();

    // 3. Render/Update Circular (Doughnut) Chart (Paid vs Remaining)
    const labels = ["გადახდილი", "გადასახდელი"];
    const dataVals = [totalPaidObligationsAmount, totalUnpaidObligationsAmount];
    const colors = ["#10b981", "#ef4444"];
    
    if (obligationsChartInstance) {
        obligationsChartInstance.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    const centerTextPlugin = {
        id: 'centerText',
        afterDraw(chart) {
            const { ctx, chartArea: { top, bottom, left, right, width, height } } = chart;
            ctx.save();
            
            if (totalUnpaidObligationsAmount === 0) {
                // Fully Paid!
                ctx.font = '300 0.75rem "Montserrat", sans-serif';
                ctx.fillStyle = '#8f9099';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('სავალდებულო', left + width / 2, top + height / 2 - 16);
                
                ctx.font = '400 1.4rem "Bebas Neue", sans-serif';
                ctx.fillStyle = '#10b981';
                ctx.fillText('დაფარულია', left + width / 2, top + height / 2 + 4);
                
                ctx.font = '300 0.65rem "Montserrat", sans-serif';
                ctx.fillStyle = '#c4c5cc';
                ctx.fillText(`ჯამი: ₾${totalObligationsAmount.toFixed(0)}`, left + width / 2, top + height / 2 + 24);
            } else {
                // Partially or fully unpaid
                ctx.font = '300 0.75rem "Montserrat", sans-serif';
                ctx.fillStyle = '#8f9099';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('დარჩენილია', left + width / 2, top + height / 2 - 16);
                
                ctx.font = '400 1.6rem "Bebas Neue", sans-serif';
                ctx.fillStyle = '#ef4444';
                ctx.fillText(`₾${totalUnpaidObligationsAmount.toFixed(0)}`, left + width / 2, top + height / 2 + 4);
                
                ctx.font = '300 0.65rem "Montserrat", sans-serif';
                ctx.fillStyle = '#c4c5cc';
                ctx.fillText(`ჯამიდან: ₾${totalObligationsAmount.toFixed(0)}`, left + width / 2, top + height / 2 + 24);
            }
            
            ctx.restore();
        }
    };
    
    obligationsChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: colors,
                borderWidth: 1,
                borderColor: '#1a1a1f'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#c4c5cc',
                        font: {
                            family: 'Montserrat',
                            size: 10
                        },
                        boxWidth: 12,
                        padding: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label;
                            const val = context.raw;
                            const total = totalObligationsAmount;
                            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                            return ` ${label}: ₾${val.toFixed(0)} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '68%'
        },
        plugins: [centerTextPlugin]
    });
}

function createObligationId() {
    return (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `ob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Confirm and record one obligation expense per obligation and calendar month.
window.payObligationDirect = async function(index) {
    if (!window.currentObligationsList || !window.currentObligationsList[index]) return;
    const ob = window.currentObligationsList[index];
    if (ob.isPaid) return;

    const confirmed = window.confirm(`ნამდვილად გსურთ "${ob.name}"-ს (₾${ob.amount.toFixed(2)}) ჩამოჭრა მიმდინარე თვის ბიუჯეტიდან?\nთანხა მომენტალურად შევა გასავლებში.`);
    if (!confirmed) return;

    try {
        const now = Date.now();
        const nowDate = new Date(now);
        const monthKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
        const obligationId = ob.id || ob.name.trim().toLowerCase().replace(/\s+/g, "-");
        const paymentKey = `${monthKey}_${obligationId}`;
        const paymentDocId = (typeof btoa === "function")
            ? `obligation_${btoa(unescape(encodeURIComponent(paymentKey))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`
            : `obligation_${encodeURIComponent(paymentKey).replace(/%/g, "_")}`;
        const paymentRef = db.collection("transactions").doc(paymentDocId);
        let created = false;
        await db.runTransaction(async transaction => {
            const existing = await transaction.get(paymentRef);
            if (existing.exists) return;
            transaction.set(paymentRef, {
            amount: parseFloat(ob.amount),
            type: "expense",
            category: "სავალდებულო ხარჯი",
            description: ob.name,
            date: now,
            createdBy: currentUserDisplayName || "სტუმარი",
            createdAt: now,
            isMandatory: true,
            obligationId: ob.id || null,
            obligationPaymentKey: paymentKey
            });
            created = true;
        });

        if (!created) {
            alert(`ხარჯი "${ob.name}" ამ თვეში უკვე გატარებულია.`);
            return;
        }

        // Trigger push and in-app activity notification
        await addActivityNotification("add", {
            amount: parseFloat(ob.amount),
            type: "expense",
            category: "სავალდებულო ხარჯი",
            description: ob.name
        });

        alert(`ხარჯი "${ob.name}" (₾${ob.amount}) წარმატებით დაემატა მიმდინარე თვის გასავლებს!`);
    } catch (err) {
        console.error("Error paying obligation:", err);
        alert("შეცდომა ხარჯის ჩამოჭრისას: " + err.message);
    }
};

window.openPayObligationModalByIndex = window.payObligationDirect;

function renderPartnersDashboard() {
    const totalExpectedEl = document.getElementById("partners-total-expected");
    const totalReceivedEl = document.getElementById("partners-total-received");
    const totalPendingEl = document.getElementById("partners-total-pending");
    const progressFillEl = document.getElementById("partners-progress-fill");
    const dashboardListEl = document.getElementById("partners-dashboard-list");

    if (!dashboardListEl || !totalExpectedEl || !totalReceivedEl || !totalPendingEl || !progressFillEl) return;

    dashboardListEl.innerHTML = "";

    if (studioRecurringIncomes.length === 0) {
        dashboardListEl.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding: 40px 0; color:var(--text-secondary); opacity:0.6; width:100%;">
                <i data-lucide="info" style="width:32px; height:32px; margin-bottom:8px; color:var(--accent-purple);"></i>
                <p style="font-size:0.9rem; font-weight:500;">პარტნიორები არ არის გაწერილი.</p>
                <p style="font-size:0.75rem; margin-top:4px; font-weight:300;">მათი მართვა შეგიძლიათ პარამეტრებიდან.</p>
            </div>
        `;
        totalExpectedEl.textContent = "₾0.00";
        totalReceivedEl.textContent = "₾0.00";
        totalPendingEl.textContent = "₾0.00";
        progressFillEl.style.width = "0%";
        if (window.lucide) lucide.createIcons();
        return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter transactions to get current month incomes
    const currentMonthIncomes = transactionsList.filter(t => {
        if (t.type !== "income") return false;
        const tDate = new Date(t.date);
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    let totalExpected = 0;
    let totalReceived = 0;
    let totalPending = 0;

    studioRecurringIncomes.forEach(p => {
        totalExpected += p.amount;

        // Check if there is an income matching the partner name (case-insensitive description match)
        const matchedTx = currentMonthIncomes.find(t => 
            (t.description || "").toLowerCase().includes(p.name.toLowerCase()) ||
            (t.category || "").toLowerCase().includes(p.name.toLowerCase())
        );

        const card = document.createElement("div");
        if (matchedTx) {
            totalReceived += matchedTx.amount;
            card.className = "partner-card-item received";
            
            const paidDateStr = new Date(matchedTx.date).toLocaleDateString('ka-GE', {
                month: 'short',
                day: 'numeric'
            });

            card.innerHTML = `
                <div class="partner-info">
                    <span class="partner-name">${p.name}</span>
                    <span class="partner-expected-amt">მოსალოდნელი: ₾${p.amount.toFixed(0)}</span>
                </div>
                <div class="partner-actions">
                    <span class="badge" style="background-color: rgba(16, 185, 129, 0.15); color: var(--success-green); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                        ჩარიცხულია (${paidDateStr})
                    </span>
                    <span style="font-family: var(--font-heading); font-size: 1.1rem; color: var(--success-green); font-weight: 600;">₾${matchedTx.amount.toFixed(0)}</span>
                </div>
            `;
        } else {
            totalPending += p.amount;
            card.className = "partner-card-item pending";
            card.innerHTML = `
                <div class="partner-info">
                    <span class="partner-name">${p.name}</span>
                    <span class="partner-expected-amt">მოსალოდნელი: ₾${p.amount.toFixed(0)}</span>
                </div>
                <div class="partner-actions">
                    <button class="btn-confirm-deposit" data-name="${p.name}" data-amount="${p.amount}">
                        <i data-lucide="check" style="width: 14px; height: 14px;"></i> დადასტურება
                    </button>
                    <span style="font-family: var(--font-heading); font-size: 1.1rem; color: var(--danger-red); font-weight: 600;">₾${p.amount.toFixed(0)}</span>
                </div>
            `;
        }

        dashboardListEl.appendChild(card);
    });

    // Update summary values
    totalExpectedEl.textContent = `₾${totalExpected.toFixed(2)}`;
    totalReceivedEl.textContent = `₾${totalReceived.toFixed(2)}`;
    totalPendingEl.textContent = `₾${totalPending.toFixed(2)}`;

    // Update progress bar
    const progressPct = totalExpected > 0 ? Math.min(100, Math.round((totalReceived / totalExpected) * 100)) : 0;
    progressFillEl.style.width = `${progressPct}%`;

    // Add click listeners to deposit buttons
    dashboardListEl.querySelectorAll(".btn-confirm-deposit").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const partnerName = e.currentTarget.getAttribute("data-name");
            const amount = parseFloat(e.currentTarget.getAttribute("data-amount"));

            if (confirm(`ნამდვილად გსურთ დაადასტუროთ ${partnerName}-სგან ჩარიცხვა თანხით ₾${amount.toFixed(0)}?`)) {
                try {
                    e.currentTarget.disabled = true;
                    e.currentTarget.textContent = "იდება...";

                    await db.collection("transactions").add({
                        amount: amount,
                        type: "income",
                        category: "პოდკასტის შემოსავალი",
                        description: `${partnerName} პარტნიორული ჩარიცხვა`,
                        date: Date.now(),
                        createdBy: currentUserDisplayName,
                        createdAt: Date.now()
                    });

                    await addActivityNotification("add", {
                        amount: amount,
                        type: "income",
                        category: "პოდკასტის შემოსავალი",
                        description: `${partnerName} პარტნიორული ჩარიცხვა`
                    });

                    // Firestore sync will automatically refresh renderPartnersDashboard
                } catch (err) {
                    console.error("Error confirming deposit:", err);
                    alert("შეცდომა დადასტურებისას: " + err.message);
                }
            }
        });
    });

    if (window.lucide) lucide.createIcons();
}

// ==========================================================================
// CALENDAR & ANALYTICS VIEWS
// ==========================================================================

function renderCalendar() {
    const calendarDaysGrid = document.getElementById("calendar-days-grid");
    const calendarMonthYearTitle = document.getElementById("calendar-month-year-title");
    
    if (!calendarDaysGrid || !calendarMonthYearTitle) return;
    
    calendarDaysGrid.innerHTML = "";
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Month Names in Georgian
    const monthNamesGeo = [
        "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
        "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"
    ];
    
    calendarMonthYearTitle.textContent = `${monthNamesGeo[month]} ${year}`;
    
    // Calculate first day index of the month (adjusted for Monday start: Mon=0, Sun=6)
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    // Total days in the current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Total days in the previous month (for padding)
    const prevTotalDays = new Date(year, month, 0).getDate();
    
    // 1. Previous month's padding cells
    for (let i = firstDayIndex; i > 0; i--) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell empty-cell";
        cell.style.opacity = "0.2";
        cell.textContent = prevTotalDays - i + 1;
        calendarDaysGrid.appendChild(cell);
    }
    
    // 2. Current month's day cells
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell";
        cell.textContent = day;
        
        // Today styling
        if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
            cell.classList.add("today");
        }
        
        // Selected day styling
        if (selectedCalendarDate.getDate() === day && selectedCalendarDate.getMonth() === month && selectedCalendarDate.getFullYear() === year) {
            cell.classList.add("selected-day");
        }
        
        // Check transactions on this day
        const dayIncomes = [];
        const dayExpenses = [];
        transactionsList.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate.getDate() === day && txDate.getMonth() === month && txDate.getFullYear() === year) {
                if (tx.type === "income") dayIncomes.push(tx);
                else dayExpenses.push(tx);
            }
        });
        
        if (dayIncomes.length > 0 || dayExpenses.length > 0) {
            const dotsContainer = document.createElement("div");
            dotsContainer.className = "day-dots";
            
            if (dayIncomes.length > 0) {
                const dot = document.createElement("span");
                dot.className = "dot-income";
                dotsContainer.appendChild(dot);
            }
            if (dayExpenses.length > 0) {
                const dot = document.createElement("span");
                dot.className = "dot-expense";
                dotsContainer.appendChild(dot);
            }
            cell.appendChild(dotsContainer);
        }
        
        // Click event listener
        cell.addEventListener("click", () => {
            selectedCalendarDate = new Date(year, month, day);
            renderCalendar();
            renderSelectedDayTransactions(selectedCalendarDate);
            // Refresh chart if filter is day
            if (activeAnalyticsFilter === "day") {
                renderAnalyticsChart();
            }
        });
        
        calendarDaysGrid.appendChild(cell);
    }
    
    // 3. Next month's padding cells (to complete a grid of 42 cells)
    const totalCellsUsed = firstDayIndex + totalDays;
    const remainingCells = 42 - totalCellsUsed;
    for (let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell empty-cell";
        cell.style.opacity = "0.2";
        cell.textContent = i;
        calendarDaysGrid.appendChild(cell);
    }
}

function renderSelectedDayTransactions(date) {
    const listEl = document.getElementById("calendar-selected-day-list");
    const labelEl = document.getElementById("calendar-selected-day-label");
    
    if (!listEl || !labelEl) return;
    
    listEl.innerHTML = "";
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const monthsGeoShort = [
        "იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"
    ];
    labelEl.textContent = `${day} ${monthsGeoShort[month]}, ${year} - ტრანზაქციები`;
    
    // Filter transactions list
    const dayTxList = transactionsList.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getDate() === day && txDate.getMonth() === month && txDate.getFullYear() === year;
    });
    
    if (dayTxList.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); opacity: 0.6; padding: 20px 0; font-size: 0.8rem;">
                ამ დღეს ტრანზაქციები არ ფიქსირდება.
            </div>
        `;
        return;
    }
    
    dayTxList.forEach(tx => {
        const item = document.createElement("div");
        item.className = "day-tx-item";
        
        const sign = tx.type === "income" ? "+" : "-";
        const colorClass = tx.type === "income" ? "income" : "expense";
        
        item.innerHTML = `
            <div class="day-tx-info">
                <span class="day-tx-title">${tx.description || "-"}</span>
                <span class="day-tx-category">${tx.category} | ${tx.createdBy || "სტუმარი"}</span>
            </div>
            <span class="day-tx-amount ${colorClass}">${sign}₾${tx.amount.toFixed(2)}</span>
        `;
        listEl.appendChild(item);
    });
}

function renderAnalyticsChart() {
    const canvas = document.getElementById("analyticsTrendChart");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    
    // Destroy existing instance
    if (analyticsTrendChartInstance) {
        analyticsTrendChartInstance.destroy();
    }
    
    let labels = [];
    let incomeData = [];
    let expenseData = [];
    let chartType = "line";
    
    if (activeAnalyticsFilter === "day") {
        chartType = "bar";
        labels = ["შემოსავალი", "გასავალი"];
        
        let dailyIncome = 0;
        let dailyExpense = 0;
        
        const year = selectedCalendarDate.getFullYear();
        const month = selectedCalendarDate.getMonth();
        const day = selectedCalendarDate.getDate();
        
        transactionsList.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate.getDate() === day && txDate.getMonth() === month && txDate.getFullYear() === year) {
                if (tx.type === "income") dailyIncome += tx.amount;
                else dailyExpense += tx.amount;
            }
        });
        
        incomeData = [dailyIncome, 0];
        expenseData = [0, dailyExpense];
        
    } else if (activeAnalyticsFilter === "week") {
        chartType = "line";
        // Get past 7 days from selected date backwards
        for (let i = 6; i >= 0; i--) {
            const tempDate = new Date(selectedCalendarDate);
            tempDate.setDate(selectedCalendarDate.getDate() - i);
            
            const m = tempDate.getMonth();
            const d = tempDate.getDate();
            const monthsGeoShort = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
            labels.push(`${d} ${monthsGeoShort[m]}`);
            
            let wInc = 0;
            let wExp = 0;
            transactionsList.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate.getDate() === d && txDate.getMonth() === m && txDate.getFullYear() === tempDate.getFullYear()) {
                    if (tx.type === "income") wInc += tx.amount;
                    else wExp += tx.amount;
                }
            });
            
            incomeData.push(wInc);
            expenseData.push(wExp);
        }
        
    } else if (activeAnalyticsFilter === "month") {
        chartType = "line";
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            labels.push(day.toString());
            
            let mInc = 0;
            let mExp = 0;
            transactionsList.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate.getDate() === day && txDate.getMonth() === month && txDate.getFullYear() === year) {
                    if (tx.type === "income") mInc += tx.amount;
                    else mExp += tx.amount;
                }
            });
            
            incomeData.push(mInc);
            expenseData.push(mExp);
        }
        
    } else if (activeAnalyticsFilter === "year") {
        chartType = "bar";
        const year = currentCalendarDate.getFullYear();
        labels = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
        
        for (let m = 0; m < 12; m++) {
            let yInc = 0;
            let yExp = 0;
            transactionsList.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate.getMonth() === m && txDate.getFullYear() === year) {
                    if (tx.type === "income") yInc += tx.amount;
                    else yExp += tx.amount;
                }
            });
            
            incomeData.push(yInc);
            expenseData.push(yExp);
        }
    }
    
    const datasets = activeAnalyticsFilter === "day" ? [
        {
            label: "შემოსავალი",
            data: incomeData,
            backgroundColor: "rgba(16, 185, 129, 0.75)",
            borderColor: "#10b981",
            borderWidth: 1,
            borderRadius: 4
        },
        {
            label: "გასავალი",
            data: expenseData,
            backgroundColor: "rgba(239, 68, 68, 0.75)",
            borderColor: "#ef4444",
            borderWidth: 1,
            borderRadius: 4
        }
    ] : [
        {
            label: "შემოსავლები",
            data: incomeData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointBackgroundColor: "#10b981"
        },
        {
            label: "გასავლები",
            data: expenseData,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointBackgroundColor: "#ef4444"
        }
    ];

    analyticsTrendChartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        color: "#c4c5cc",
                        font: { family: "Inter" }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#8a8b99" }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#8a8b99" }
                }
            }
        }
    });
}

// ==========================================================================
// TRANSACTIONS ADMINISTRATION VIEW
// ==========================================================================

function renderAdminTransactionsTable() {
    const listBody = document.getElementById("admin-transactions-list");
    const noAdminTx = document.getElementById("no-admin-transactions");
    
    if (!listBody) return;
    
    listBody.innerHTML = "";
    
    if (transactionsList.length === 0) {
        if (noAdminTx) noAdminTx.classList.remove("hidden");
        return;
    }
    
    if (noAdminTx) noAdminTx.classList.add("hidden");
    
    transactionsList.forEach(tx => {
        const tr = document.createElement("tr");
        
        const dateStr = new Date(tx.date).toLocaleDateString('ka-GE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const typeBadge = tx.type === "income" 
            ? `<span class="badge" style="background-color:rgba(16,185,129,0.1); color:#10b981; border: 1px solid rgba(16,185,129,0.2);">შემოსავალი</span>`
            : `<span class="badge" style="background-color:rgba(239,68,68,0.1); color:#ef4444; border: 1px solid rgba(239,68,68,0.2);">გასავალი</span>`;
        
        const amtSign = tx.type === "income" ? "+₾" : "-₾";
        const amtColor = tx.type === "income" ? "income" : "expense";
        
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${typeBadge}</td>
            <td>${tx.category}</td>
            <td>${tx.description || "-"}</td>
            <td class="table-amount ${amtColor}">${amtSign}${tx.amount.toFixed(2)}</td>
            <td><span class="user-display-name">${tx.createdBy || "სტუმარი"}</span></td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="btn-icon btn-action-edit" data-id="${tx.id}" title="რედაქტირება" style="background:none; border:none; cursor:pointer;">
                    <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn-icon btn-action-delete" data-id="${tx.id}" title="წაშლა" style="background:none; border:none; cursor:pointer;">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </td>
        `;
        listBody.appendChild(tr);
    });
    
    // Attach event listeners
    listBody.querySelectorAll(".btn-action-delete").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            const tx = transactionsList.find(t => t.id === id);
            if (confirm("ნამდვილად გსურთ ამ ტრანზაქციის წაშლა?")) {
                try {
                    await db.collection("transactions").doc(id).delete();
                    if (tx) {
                        await addActivityNotification("delete", tx);
                    }
                    // Firebase listener triggers sync, but reload for UI instant update
                    renderAdminTransactionsTable();
                } catch (err) {
                    console.error("Failed to delete transaction:", err);
                    alert("შეცდომა წაშლისას: " + err.message);
                }
            }
        });
    });

    listBody.querySelectorAll(".btn-action-edit").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.getAttribute("data-id");
            const tx = transactionsList.find(t => t.id === id);
            if (tx) {
                openEditTransactionModal(tx);
            }
        });
    });
    
    if (window.lucide) lucide.createIcons();
}

function openEditTransactionModal(tx) {
    const editModal = document.getElementById("edit-transaction-modal");
    if (!editModal) return;
    
    document.getElementById("edit-tx-id").value = tx.id;
    document.getElementById("edit-tx-type").value = tx.type;
    document.getElementById("edit-tx-amount").value = tx.amount;
    
    // Format date as YYYY-MM-DD
    const d = new Date(tx.date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    document.getElementById("edit-tx-date").value = `${year}-${month}-${day}`;
    
    const categorySelect = document.getElementById("edit-tx-category");
    categorySelect.innerHTML = "";
    
    const options = tx.type === "income" ? categories.income : categories.expense;
    options.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        categorySelect.appendChild(o);
    });
    
    if (tx.type === "expense") {
        const o = document.createElement("option");
        o.value = "სავალდებულო ხარჯი";
        o.textContent = "სავალდებულო ხარჯი";
        categorySelect.appendChild(o);
    }
    
    categorySelect.value = tx.category;
    document.getElementById("edit-tx-desc").value = tx.description || "";
    
    editModal.classList.remove("hidden");
}

// ==========================================================================
// REAL-TIME NOTIFICATIONS LOGIC
// ==========================================================================

let unsubscribeNotifications = null;
let notificationsList = [];

function connectNotificationsSync() {
    if (unsubscribeNotifications) unsubscribeNotifications();
    
    unsubscribeNotifications = db.collection("notifications")
        .orderBy("createdAt", "desc")
        .limit(20)
        .onSnapshot(snapshot => {
            notificationsList = [];
            snapshot.forEach(docSnap => {
                notificationsList.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });
            renderNotificationsUI();
        }, error => {
            console.error("Notifications sync error:", error);
        });
}

function renderNotificationsUI() {
    const listEl = document.getElementById("notification-list");
    const badgeEl = document.getElementById("notification-badge");
    
    if (!listEl || !badgeEl) return;
    
    listEl.innerHTML = "";
    
    if (notificationsList.length === 0) {
        listEl.innerHTML = `<div class="notification-empty" style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 0.8rem;">შეტყობინებები არ არის</div>`;
        badgeEl.classList.add("hidden");
        return;
    }
    
    let hasUnread = false;
    
    notificationsList.forEach(n => {
        const isUnread = n.read === false;
        if (isUnread) hasUnread = true;
        
        const item = document.createElement("div");
        item.className = "notification-item " + (isUnread ? "unread" : "read");
        
        const dateStr = new Date(n.createdAt).toLocaleDateString('ka-GE', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        item.innerHTML = `
            <div>${n.message}</div>
            <span class="notification-time">${dateStr}</span>
        `;
        
        // Mark as read in Firestore on click
        item.addEventListener("click", async () => {
            if (isUnread) {
                try {
                    await db.collection("notifications").doc(n.id).update({ read: true });
                } catch (e) {
                    console.error("Error marking notification as read:", e);
                }
            }
        });
        
        listEl.appendChild(item);
    });
    
    // Update red bell badge based on Firestore unread state
    if (hasUnread) {
        badgeEl.classList.remove("hidden");
        
        const newestNotification = notificationsList[0];
        const lastSeenNotifId = localStorage.getItem("last_seen_notification_id");
        if (newestNotification.read === false && newestNotification.createdBy !== currentUserDisplayName && newestNotification.id !== lastSeenNotifId) {
            localStorage.setItem("last_seen_notification_id", newestNotification.id);
            triggerWebNotification("Budgeted Studio", newestNotification.message);
        }
    } else {
        badgeEl.classList.add("hidden");
    }
}

function triggerWebNotification(title, message) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notifTitle = title || "Budgeted Studio";
        const notifIcon = "icons/icon-192x192.png"; // Fallback to existing icons/icon-192x192.png in root
        if (navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(reg => {
                reg.showNotification(notifTitle, {
                    body: message,
                    icon: notifIcon,
                    badge: notifIcon
                });
            });
        } else {
            new Notification(notifTitle, {
                body: message,
                icon: notifIcon
            });
        }
    }
}

async function addActivityNotification(actionType, txData) {
    const actor = currentUserDisplayName || "სტუმარი";
    let message = "";
    
    const typeLabel = txData.type === "expense" ? "გასავალი" : "შემოსავალი";
    const amountLabel = `₾${parseFloat(txData.amount).toFixed(2)}`;
    
    if (actionType === "add") {
        message = `${actor}-მ დაამატა ${typeLabel}: ${amountLabel} - ${txData.category} (${txData.description || "-"})`;
    } else if (actionType === "update") {
        message = `${actor}-მ შეცვალა ტრანზაქცია: ${typeLabel} - ${amountLabel} (${txData.category})`;
    } else if (actionType === "delete") {
        message = `${actor}-მ წაშალა ტრანზაქცია: ${typeLabel} - ${amountLabel} (${txData.category})`;
    }
    
    if (message) {
        try {
            await db.collection("notifications").add({
                message: message,
                createdBy: actor,
                createdAt: Date.now(),
                read: false
            });

            // Push delivery must be sent by a trusted backend. Never expose
            // FCM server keys or OneSignal REST keys in browser code.
        } catch (e) {
            console.error("Error adding notification:", e);
        }
    }
}

async function addSettingsActivityNotification(changedSections) {
    const actor = currentUserDisplayName || "მომხმარებელი";
    const message = `${actor}-მ შეცვალა ბიუჯეტის პარამეტრები: ${changedSections.join(", ")}`;
    try {
        await db.collection("notifications").add({
            message,
            createdBy: actor,
            createdAt: Date.now(),
            read: false,
            type: "settings"
        });
    } catch (error) {
        console.error("Error adding settings notification:", error);
    }
}
