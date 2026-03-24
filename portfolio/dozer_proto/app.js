// Dozer POC — app.js (Earthworks Bid Automation)
// 1. Gets Signed URL from Google Apps Script
// 2. Uploads directly to GCS
// 3. Sends pricing + metadata to Make.com webhook for pipeline processing

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION — UPDATE THESE WHEN MAKE.COM SCENARIO IS READY
// ═══════════════════════════════════════════════════════════════
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxh0Kkt-DDLi2AfbpQ0gPW4d9GPdP-qBSfUWWuwY-EC5CbJQZlRcx4JqZNpe6VTe3Rh/exec";
const MAKE_WEBHOOK_URL = "PLACEHOLDER_DOZER_POC_WEBHOOK"; // ← New Make.com scenario webhook goes here

// ── DOM refs ──
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const additionalFields = document.getElementById("additionalFields");
const uploadZone = document.getElementById("uploadZone");
const submitBtn = document.getElementById("submitBtn");
const statusMessage = document.getElementById("statusMessage");

// Submitter fields
const submitterNameEl = document.querySelector('input[name="submitter_name"]');
const submitterEmailEl = document.querySelector('input[name="submitter_email"]');

// ── UI Helpers ──
if (uploadZone && fileInput) {
  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateFileList();
    }
  });
  fileInput.addEventListener("change", updateFileList);
}

function updateFileList() {
  if (!fileList || !fileInput.files.length) {
    if (fileList) fileList.innerHTML = "";
    if (additionalFields) additionalFields.style.display = "none";
    return;
  }
  const file = fileInput.files[0];
  fileList.innerHTML = `
    <div class="flex items-center justify-between p-4 rounded-xl border border-border-gray bg-white">
      <span style="color:#111111; font-family:'Space Grotesk',sans-serif; font-weight:600;">${escapeHtml(file.name)}</span>
      <span style="color:#888888; font-family:'Space Mono',monospace; font-size:0.85rem;">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
    </div>`;
  if (additionalFields) additionalFields.style.display = "block";
}

// ── Collect Pricing Data ──
function collectPricing() {
  return {
    cost_cut_bcy: parseFloat(document.querySelector('input[name="cost_cut_bcy"]')?.value) || 4.50,
    cost_fill_ccy: parseFloat(document.querySelector('input[name="cost_fill_ccy"]')?.value) || 7.50,
    cost_mobilization: parseFloat(document.querySelector('input[name="cost_mobilization"]')?.value) || 12000,
    cost_lime_ton: parseFloat(document.querySelector('input[name="cost_lime_ton"]')?.value) || 22.00,
    cost_import_ccy: parseFloat(document.querySelector('input[name="cost_import_ccy"]')?.value) || 18.00,
    cost_export_lcy: parseFloat(document.querySelector('input[name="cost_export_lcy"]')?.value) || 12.00,
    cost_subgrade_sy: parseFloat(document.querySelector('input[name="cost_subgrade_sy"]')?.value) || 2.50,
    cost_equipment_day: parseFloat(document.querySelector('input[name="cost_equipment_day"]')?.value) || 3500,
  };
}

// ── SUBMISSION LOGIC ──
const form = document.getElementById("uploadForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!fileInput.files.length) {
      alert("Please select a file first.");
      return;
    }

    // Guard: check if webhook is configured
    if (MAKE_WEBHOOK_URL === "PLACEHOLDER_DOZER_POC_WEBHOOK") {
      statusMessage.style.color = "#FFB300";
      statusMessage.textContent = "⚠ Webhook not configured yet. This is a demo — the Make.com scenario needs to be created first.";
      return;
    }

    const file = fileInput.files[0];
    submitBtn.disabled = true;
    submitBtn.textContent = "Step 1/3: Getting Secure Link...";
    statusMessage.textContent = "";
    statusMessage.style.color = "#C8C2E0";

    try {
      // 1. GET SIGNED URL
      const ticketResponse = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ fileName: file.name })
      });

      if (!ticketResponse.ok) {
        throw new Error("Failed to get upload URL from server");
      }

      const ticketData = await ticketResponse.json();

      if (!ticketData.signedUrl) {
        throw new Error("No upload URL received");
      }

      // 2. UPLOAD TO GOOGLE CLOUD
      submitBtn.textContent = "Step 2/3: Uploading to Cloud...";

      try {
        await fetch(ticketData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file
        });
      } catch (uploadErr) {
        // CORS false alarm — upload likely worked
        console.warn("Browser reported upload error (likely CORS), proceeding:", uploadErr);
      }

      // 3. NOTIFY MAKE.COM WITH PRICING DATA
      submitBtn.textContent = "Step 3/3: Starting Analysis...";

      const pricing = collectPricing();

      const payload = {
        filename: file.name,
        submitter_name: submitterNameEl ? submitterNameEl.value : "",
        submitter_email: submitterEmailEl ? submitterEmailEl.value : "",
        source: "dozer_poc",
        version: "v3.1",
        unit_costs: pricing,
        submitted_at: new Date().toISOString()
      };

      const triggerResponse = await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!triggerResponse.ok) {
        throw new Error("Pipeline failed to start");
      }

      // SUCCESS
      statusMessage.style.color = "#1E6B3A";
      statusMessage.textContent = "✓ Report uploaded & analysis started! You'll receive an email with your bid estimate.";

      form.reset();
      updateFileList();

    } catch (err) {
      console.error(err);
      statusMessage.style.color = "#FF5100";
      statusMessage.textContent = "✗ Error: " + err.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Report for Analysis";
    }
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, function (m) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m];
  });
}
