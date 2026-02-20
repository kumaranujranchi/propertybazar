import { convex } from './convex.js';
import { getToken, requireAuth } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnIndiv = document.getElementById('btnIndividual');
  const btnAgent = document.getElementById('btnAgent');
  const indivPlans = document.getElementById('individualPlans');
  const agentPlans = document.getElementById('agentPlans');
  const slider = document.getElementById('toggleSlider');

  // Toggle Logic
  if (btnIndiv && btnAgent) {
    btnIndiv.addEventListener('click', () => {
      btnIndiv.classList.add('active');
      btnAgent.classList.remove('active');
      slider.style.transform = 'translateX(0)';
      indivPlans.style.display = 'flex';
      agentPlans.style.display = 'none';
    });

    btnAgent.addEventListener('click', () => {
      btnAgent.classList.add('active');
      btnIndiv.classList.remove('active');
      slider.style.transform = 'translateX(100%)';
      agentPlans.style.display = 'flex';
      indivPlans.style.display = 'none';
    });
  }

  // Payment Flow Logic
  let selectedTier = '';
  let selectedDays = 0;
  let selectedPrice = 0;

  const modal = document.getElementById('paymentModal');
  const title = document.getElementById('paymentTitle');
  const desc = document.getElementById('paymentDesc');
  const loader = document.getElementById('paymentLoader');
  const actions = document.getElementById('paymentActions');
  const successBadge = document.getElementById('paymentSuccess');
  
  const btnConfirm = document.getElementById('btnConfirmPay');
  const btnCancel = document.getElementById('btnCancelPay');

  document.querySelectorAll('.upgrade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Must be logged in to buy a plan
      e.preventDefault();
      requireAuth();
      if (!getToken()) return;

      selectedTier = e.target.dataset.tier;
      selectedDays = parseInt(e.target.dataset.days);
      selectedPrice = parseInt(e.target.dataset.price);

      title.innerText = `Upgrade to ${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)}`;
      desc.innerText = `You are about to be charged ₹${selectedPrice.toLocaleString('en-IN')}.`;
      
      // Reset Modal state
      loader.style.display = 'none';
      actions.style.display = 'block';
      successBadge.style.display = 'none';
      
      modal.classList.add('open');
    });
  });

  if (btnCancel) {
    btnCancel.addEventListener('click', () => modal.classList.remove('open'));
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      actions.style.display = 'none';
      loader.style.display = 'block';

      try {
        // Trigger Convex Mutation
        const token = getToken();
        await convex.mutation("auth:upgradeTier", {
          token,
          tier: selectedTier,
          durationDays: selectedDays
        });

        // Show Success
        loader.style.display = 'none';
        successBadge.style.display = 'block';

        // Redirect to Dashboard after 1.5s
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);

      } catch (err) {
        alert("Payment failed: " + err.message);
        actions.style.display = 'block';
        loader.style.display = 'none';
      }
    });
  }
});
