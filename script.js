/*
 * script.js for the App Hub landing page
 * Handles simple dynamic behavior such as updating the footer year and
 * applying staggered animation delays to the cards so they appear one after the other.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Update year in footer
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
  // Add staggered animation delays to cards
  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    // Each card will start slightly later than the previous one
    card.style.setProperty('--delay', `${index * 0.1}s`);
  });
});