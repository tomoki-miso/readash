<script lang="ts">
  import iconUrl from '@/assets/icon.png';

  async function openSettings() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      browser.tabs.sendMessage(tab.id, { type: 'OPEN_SETTINGS' });
      window.close();
    }
  }

  async function startReading() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      browser.tabs.sendMessage(tab.id, { type: 'START_READING' });
      window.close();
    }
  }
</script>

<main class="p-5 min-w-[320px] font-sans">
  <div class="text-center mb-6">
    <img src={iconUrl} alt="Readash" class="w-64 mb-3 inline-block">
  </div>

  <div class="flex flex-col gap-3 mb-6">
    <button
      class="px-5 py-3.5 border-none rounded-lg text-base font-medium cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 bg-linear-to-br from-[#667eea] to-[#764ba2] text-white hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)]"
      on:click={startReading}
    >
      <span class="text-xl">📖</span>
      速読を開始
    </button>

    <button
      class="px-5 py-3.5 border-none rounded-lg text-base font-medium cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 bg-gray-100 text-gray-800 hover:bg-gray-200"
      on:click={openSettings}
    >
      <span class="text-xl">⚙️</span>
      設定
    </button>
  </div>

  <div class="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 leading-relaxed">
    <p class="mb-2">📍 現在のページで速読モードを開始できます</p>
    <p class="mb-0">⌨️ 操作: スペース/矢印キーで進む、ESCで終了</p>
  </div>
</main>
