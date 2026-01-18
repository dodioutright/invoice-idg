document.addEventListener("DOMContentLoaded", function () {
  // ============================================
  // CONSTANTS & ELEMENT REFERENCES
  // ============================================
  const STORAGE_KEYS = {
    DRAFT: 'invoiceDraft',
    HISTORY: 'invoiceHistory'
  };

  const warningModal = document.getElementById("warningModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const historyModal = document.getElementById("historyModal");
  const historyBtn = document.getElementById("historyBtn");
  const closeHistoryBtn = document.getElementById("closeHistoryBtn");
  const historyList = document.getElementById("historyList");
  const clearFormBtn = document.getElementById("clearFormBtn");
  const validationAlert = document.getElementById("validationAlert");
  const validationMessage = document.getElementById("validationMessage");

  // Custom Confirm Dialog
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmCancelBtn = document.getElementById("confirmCancelBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  let pendingDeleteRow = null;

  const addItemBtn = document.getElementById("addItemBtn");
  const itemsContainer = document.getElementById("itemsContainer");
  const previewBtn = document.getElementById("previewBtn");
  const generatePdfBtn = document.getElementById("generatePdfBtn");
  const invoicePreview = document.getElementById("invoice-preview");
  const logoUpload = document.getElementById("logoUpload");
  const logoFileName = document.getElementById("logoFileName");
  const templateSelect = document.getElementById("templateSelect");
  const generateInvoiceBtn = document.getElementById("generateInvoiceBtn");
  const invoiceNumberInput = document.getElementById("invoiceNumber");

  // ============================================
  // AUTO-INCREMENT INVOICE NUMBER
  // ============================================
  const generateInvoiceNumber = () => {
    const currentYear = new Date().getFullYear();
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];
    
    // Find highest number for current year
    let maxNumber = 0;
    const yearPattern = new RegExp(`^INV-${currentYear}-(\\d+)$`);
    
    history.forEach(entry => {
      const match = entry.invoiceNumber?.match(yearPattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    });

    // Also check current draft
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.DRAFT)) || {};
    if (draft.invoiceNumber) {
      const match = draft.invoiceNumber.match(yearPattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    }

    // Generate next number
    const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
    return `INV-${currentYear}-${nextNumber}`;
  };

  // Generate button click handler
  if (generateInvoiceBtn && invoiceNumberInput) {
    generateInvoiceBtn.addEventListener("click", () => {
      invoiceNumberInput.value = generateInvoiceNumber();
      debouncedSave();
    });
  }

  // ============================================
  // FORMAT RUPIAH
  // ============================================
  const formatRupiah = (input) => {
    let value = input.value.replace(/\D/g, '');
    if (value === '') {
      input.value = '';
      return;
    }
    input.value = parseInt(value).toLocaleString('id-ID');
  };

  const parseRupiah = (str) => {
    if (!str) return 0;
    return parseInt(str.replace(/\./g, '')) || 0;
  };

  // ============================================
  // VALIDATION
  // ============================================
  const showValidationError = (message) => {
    validationMessage.textContent = message;
    validationAlert.classList.remove('hidden');
    setTimeout(() => {
      validationAlert.classList.add('hidden');
    }, 3000);
  };

  const validateForm = () => {
    const invoiceNumber = document.getElementById("invoiceNumber").value.trim();
    const invoiceDate = document.getElementById("invoiceDate").value;
    
    if (!invoiceNumber) {
      showValidationError("Nomor Invoice wajib diisi!");
      return false;
    }
    if (!invoiceDate) {
      showValidationError("Tanggal Invoice wajib diisi!");
      return false;
    }
    return true;
  };

  // ============================================
  // AUTO-SAVE DRAFT
  // ============================================
  const getFormData = () => {
    const items = [];
    itemsContainer.querySelectorAll(".grid").forEach(row => {
      items.push({
        description: row.querySelector(".item-description")?.value || '',
        qty: row.querySelector(".item-qty")?.value || '',
        price: row.querySelector(".item-price")?.value || ''
      });
    });

    return {
      companyAddress: document.getElementById("companyAddress").value,
      clientAddress: document.getElementById("clientAddress").value,
      invoiceNumber: document.getElementById("invoiceNumber").value,
      invoiceDate: document.getElementById("invoiceDate").value,
      template: templateSelect?.value || 'template.html',
      pembayaranAwal: document.getElementById("pembayaranAwal").value,
      paymentInstructions: document.getElementById("paymentInstructions").value,
      items: items
    };
  };

  const saveFormDraft = () => {
    const data = getFormData();
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(data));
  };

  const loadFormDraft = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (!saved) return false;

    try {
      const data = JSON.parse(saved);
      
      document.getElementById("companyAddress").value = data.companyAddress || '';
      document.getElementById("clientAddress").value = data.clientAddress || '';
      document.getElementById("invoiceNumber").value = data.invoiceNumber || '';
      document.getElementById("invoiceDate").value = data.invoiceDate || '';
      if (templateSelect) templateSelect.value = data.template || 'template.html';
      document.getElementById("pembayaranAwal").value = data.pembayaranAwal || '';
      document.getElementById("paymentInstructions").value = data.paymentInstructions || '';

      // Clear existing items and load saved items
      itemsContainer.innerHTML = '';
      if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
          addItemRow(item.description, item.qty, item.price);
        });
      } else {
        addItemRow();
      }

      return true;
    } catch (e) {
      console.error("Error loading draft:", e);
      return false;
    }
  };

  const clearFormDraft = () => {
    if (confirm("Yakin ingin menghapus semua data form?")) {
      localStorage.removeItem(STORAGE_KEYS.DRAFT);
      location.reload();
    }
  };

  // Debounce auto-save
  let saveTimeout;
  const debouncedSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveFormDraft, 500);
  };

  // ============================================
  // INVOICE HISTORY
  // ============================================
  const getHistory = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];
    } catch {
      return [];
    }
  };

  const saveToHistory = (data) => {
    let history = getHistory();
    const invoiceNum = data.invoiceNumber || 'Tanpa Nomor';
    
    // Check if invoice number already exists
    const existingIndex = history.findIndex(h => h.invoiceNumber === invoiceNum);
    
    const entry = {
      id: existingIndex >= 0 ? history[existingIndex].id : Date.now(),
      date: new Date().toLocaleDateString('id-ID'),
      invoiceNumber: invoiceNum,
      clientName: data.clientAddress.split('\n')[0] || 'Tanpa Klien',
      data: data
    };
    
    if (existingIndex >= 0) {
      // Update existing entry and move to top
      history.splice(existingIndex, 1);
    }
    
    // Add to top
    history.unshift(entry);
    
    // Keep max 20 entries
    if (history.length > 20) history.pop();
    
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  };

  const renderHistory = () => {
    const history = getHistory();
    
    if (history.length === 0) {
      historyList.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Belum ada riwayat invoice</p>';
      return;
    }

    historyList.innerHTML = history.map(entry => `
      <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800 text-sm truncate">${entry.invoiceNumber}</p>
          <p class="text-xs text-slate-500 truncate">${entry.clientName} • ${entry.date}</p>
        </div>
        <div class="flex items-center gap-2 ml-3">
          <button onclick="loadFromHistory(${entry.id})" class="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition-all">Load</button>
          <button onclick="deleteFromHistory(${entry.id})" class="text-xs bg-red-100 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1.5 rounded-lg transition-all">Hapus</button>
        </div>
      </div>
    `).join('');
  };

  // Global functions for history buttons
  window.loadFromHistory = (id) => {
    const history = getHistory();
    const entry = history.find(h => h.id === id);
    if (!entry) return;

    const data = entry.data;
    document.getElementById("companyAddress").value = data.companyAddress || '';
    document.getElementById("clientAddress").value = data.clientAddress || '';
    document.getElementById("invoiceNumber").value = data.invoiceNumber || '';
    document.getElementById("invoiceDate").value = data.invoiceDate || '';
    if (templateSelect) templateSelect.value = data.template || 'template.html';
    document.getElementById("pembayaranAwal").value = data.pembayaranAwal || '';
    document.getElementById("paymentInstructions").value = data.paymentInstructions || '';

    itemsContainer.innerHTML = '';
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        addItemRow(item.description, item.qty, item.price);
      });
    } else {
      addItemRow();
    }

    historyModal.classList.add('hidden');
    saveFormDraft();
  };

  // Track pending history delete
  let pendingHistoryDeleteId = null;

  window.deleteFromHistory = (id) => {
    const history = getHistory();
    const entry = history.find(h => h.id === id);
    if (!entry) return;
    
    pendingHistoryDeleteId = id;
    confirmMessage.textContent = `Hapus invoice "${entry.invoiceNumber}" dari riwayat?`;
    confirmDialog.classList.remove("hidden");
  };

  // Extended confirm dialog handler for both item and history delete
  const executeConfirmDelete = () => {
    if (pendingDeleteRow) {
      pendingDeleteRow.remove();
      debouncedSave();
      pendingDeleteRow = null;
    }
    if (pendingHistoryDeleteId !== null) {
      const history = getHistory().filter(h => h.id !== pendingHistoryDeleteId);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
      renderHistory();
      pendingHistoryDeleteId = null;
    }
    confirmDialog.classList.add("hidden");
  };

  const cancelConfirmDelete = () => {
    confirmDialog.classList.add("hidden");
    pendingDeleteRow = null;
    pendingHistoryDeleteId = null;
  };

  // ============================================
  // MODAL HANDLERS
  // ============================================
  const closeWarningModal = () => {
    if (warningModal) warningModal.classList.add("hidden");
  };

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeWarningModal);
  }

  if (warningModal) {
    warningModal.addEventListener("click", (event) => {
      if (event.target === warningModal) closeWarningModal();
    });
  }

  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      renderHistory();
      historyModal.classList.remove("hidden");
    });
  }

  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener("click", () => {
      historyModal.classList.add("hidden");
    });
  }

  if (historyModal) {
    historyModal.addEventListener("click", (event) => {
      if (event.target === historyModal) {
        historyModal.classList.add("hidden");
      }
    });
  }

  if (clearFormBtn) {
    clearFormBtn.addEventListener("click", clearFormDraft);
  }

  // ============================================
  // LOGO UPLOAD
  // ============================================
  if (logoUpload && logoFileName) {
    logoUpload.addEventListener("change", function () {
      if (this.files[0]) {
        logoFileName.textContent = "✓ " + this.files[0].name;
        logoFileName.classList.add("text-emerald-600");
      }
    });
  }

  // ============================================
  // ITEM ROW FUNCTIONS
  // ============================================
  const calculateRowTotal = (row) => {
    const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
    const priceStr = row.querySelector(".item-price").value;
    const price = parseRupiah(priceStr);
    const total = qty * price;
    const totalDisplay = row.querySelector(".item-total");
    if (totalDisplay) {
      totalDisplay.textContent = total.toLocaleString("id-ID");
    }
  };

  const addItemRow = (description = '', qty = '', price = '') => {
    const itemRow = document.createElement("div");
    itemRow.classList.add(
      "grid", "grid-cols-2", "md:grid-cols-12", "gap-2", "p-3",
      "bg-white", "border", "border-slate-200", "rounded-xl", "fade-in"
    );
    itemRow.innerHTML = `
      <input type="text" placeholder="Keterangan item" value="${description}" class="input-modern col-span-2 md:col-span-5 p-3 border border-slate-200 rounded-lg text-sm item-description">
      <input type="number" placeholder="QTY" value="${qty}" class="input-modern col-span-1 md:col-span-2 p-3 border border-slate-200 rounded-lg text-sm text-center item-qty">
      <input type="text" placeholder="Harga" value="${price}" class="input-modern col-span-1 md:col-span-2 p-3 border border-slate-200 rounded-lg text-sm text-center item-price">
      <div class="col-span-1 md:col-span-2 flex items-center justify-start md:justify-end gap-1">
        <span class="text-xs text-slate-400 md:hidden">Total:</span>
        <span class="text-sm font-semibold text-slate-700 item-total">0</span>
      </div>
      <div class="col-span-1 md:col-span-1 flex items-center justify-end md:justify-center">
        <button class="removeItemBtn w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
    itemsContainer.appendChild(itemRow);

    const qtyInput = itemRow.querySelector(".item-qty");
    const priceInput = itemRow.querySelector(".item-price");
    const descInput = itemRow.querySelector(".item-description");

    // Format Rupiah on price input
    priceInput.addEventListener("input", () => {
      formatRupiah(priceInput);
      calculateRowTotal(itemRow);
      debouncedSave();
    });

    qtyInput.addEventListener("input", () => {
      calculateRowTotal(itemRow);
      debouncedSave();
    });

    descInput.addEventListener("input", debouncedSave);

    // Calculate initial total if values provided
    if (qty && price) {
      calculateRowTotal(itemRow);
    }
  };

  // Remove item handler - show custom confirm dialog
  itemsContainer.addEventListener("click", function (e) {
    if (e.target.classList.contains("removeItemBtn") || e.target.closest(".removeItemBtn")) {
      const row = e.target.closest(".grid");
      if (row && itemsContainer.children.length > 1) {
        const description = row.querySelector(".item-description")?.value || "item ini";
        pendingDeleteRow = row;
        confirmMessage.textContent = `Apakah Anda yakin ingin menghapus "${description}" dari daftar?`;
        confirmDialog.classList.remove("hidden");
      }
    }
  });

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", executeConfirmDelete);
  }

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener("click", cancelConfirmDelete);
  }

  if (confirmDialog) {
    confirmDialog.addEventListener("click", (e) => {
      if (e.target === confirmDialog) {
        cancelConfirmDelete();
      }
    });
  }

  addItemBtn.addEventListener("click", () => {
    addItemRow();
    debouncedSave();
  });

  // ============================================
  // AUTO-SAVE EVENT LISTENERS
  // ============================================
  const formInputs = [
    'companyAddress', 'clientAddress', 'invoiceNumber', 
    'invoiceDate', 'pembayaranAwal', 'paymentInstructions'
  ];

  formInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', debouncedSave);
      el.addEventListener('change', debouncedSave);
    }
  });

  if (templateSelect) {
    templateSelect.addEventListener('change', debouncedSave);
  }

  // Format Rupiah for pembayaranAwal
  const pembayaranAwalInput = document.getElementById("pembayaranAwal");
  if (pembayaranAwalInput) {
    pembayaranAwalInput.addEventListener("input", () => {
      formatRupiah(pembayaranAwalInput);
      debouncedSave();
    });
  }

  // ============================================
  // PREVIEW INVOICE
  // ============================================
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  previewBtn.addEventListener("click", async () => {
    // Validate first
    if (!validateForm()) return;

    let logoSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const logoFile = logoUpload.files[0];

    if (logoFile) {
      try {
        logoSrc = await readFileAsDataURL(logoFile);
      } catch (error) {
        console.error("Error reading logo file:", error);
      }
    }

    const selectedTemplate = templateSelect ? templateSelect.value : "template.html";
    let template = await (await fetch(selectedTemplate)).text();
    template = template.replace("{{logoSrc}}", logoSrc);

    const companyAddress = document.getElementById("companyAddress").value.replace(/\n/g, "<br>");
    const clientAddress = document.getElementById("clientAddress").value.replace(/\n/g, "<br>");
    const invoiceNumber = document.getElementById("invoiceNumber").value;
    const rawDate = document.getElementById("invoiceDate").value;
    let invoiceDate = rawDate;

    if (rawDate) {
      const parts = rawDate.split("-");
      invoiceDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const pembayaranAwalStr = document.getElementById("pembayaranAwal").value;
    const pembayaranAwal = parseRupiah(pembayaranAwalStr);
    const paymentInstructions = document.getElementById("paymentInstructions").value.replace(/\n/g, "<br>");

    let itemsHtml = "";
    let subtotal = 0;
    const itemRows = itemsContainer.querySelectorAll(".grid");
    itemRows.forEach((row, index) => {
      const description = row.querySelector(".item-description").value;
      const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
      const priceStr = row.querySelector(".item-price").value;
      const price = parseRupiah(priceStr);
      const total = qty * price;
      subtotal += total;

      itemsHtml += `
        <tr class="${index % 2 === 0 ? "bg-gray-50" : ""}">
          <td class="px-3 py-2 font-semibold">${index + 1}</td>
          <td class="px-3 py-2">${description}</td>
          <td class="px-3 py-2 text-center">${qty}</td>
          <td class="px-3 py-2 text-right">${price.toLocaleString("id-ID")}</td>
          <td class="px-3 py-2 text-right font-medium">${total.toLocaleString("id-ID")}</td>
        </tr>
      `;
    });

    const sisaTagihan = subtotal - pembayaranAwal;

    template = template.replace("{{items}}", itemsHtml);
    template = template.replace("{{companyAddress}}", companyAddress);
    template = template.replace("{{clientAddress}}", clientAddress);
    template = template.replace("{{invoiceNumber}}", invoiceNumber);
    template = template.replace("{{invoiceDate}}", invoiceDate);
    template = template.replace("{{subtotal}}", subtotal.toLocaleString("id-ID"));
    template = template.replace("{{pembayaranAwal}}", pembayaranAwal.toLocaleString("id-ID"));
    template = template.replace("{{sisaTagihan}}", sisaTagihan.toLocaleString("id-ID"));
    template = template.replace("{{total}}", sisaTagihan.toLocaleString("id-ID"));
    template = template.replace("{{paymentInstructions}}", paymentInstructions);

    // Save to history
    saveToHistory(getFormData());

    // Store in localStorage and open new window
    localStorage.setItem('invoicePreviewData', template);
    localStorage.setItem('invoiceNumber', invoiceNumber || 'Invoice');
    
    window.open('preview.html', '_blank', 'width=900,height=800,scrollbars=yes');
  });

  // ============================================
  // GENERATE PDF (fallback if used from main page)
  // ============================================
  generatePdfBtn.addEventListener("click", () => {
    const invoiceToPrint = invoicePreview.innerHTML;
    const invoiceNumber = document.getElementById("invoiceNumber").value;

    const opt = {
      margin: 0.5,
      filename: `Invoice-${invoiceNumber || "file"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(invoiceToPrint).set(opt).save();
  });

  // ============================================
  // INITIALIZE
  // ============================================
  const loaded = loadFormDraft();
  if (!loaded) {
    addItemRow();
  }
});
