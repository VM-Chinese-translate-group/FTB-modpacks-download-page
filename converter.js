document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById("loading-modal");
  modal.classList.add("is-active");

  const progress = document.getElementById("loading-progress");

  // 尝试从localStorage获取缓存数据
  let cachedPacks = JSON.parse(localStorage.getItem('cachedPacks')) || {};

  fetch('https://api.modpacks.ch/public/modpack/all')
    .then(response => response.json())
    .then(data => {
      progress.max = data.packs.length;
      requestPacks(data.packs);
    });

  let allPacks = [];
  const packList = document.getElementById("pack-list");
  const search = document.getElementById("search");
  const filter = document.getElementById("filter");

  search.addEventListener("input", (e) => doSearch(e.target.value));
  filter.addEventListener("change", () => displayPacks(true));

  async function requestPacks(packs) {
    const fetches = packs.map(async (pack) => {
      // 先尝试从缓存中获取数据
      let packData = cachedPacks[pack];
      if (!packData) {
        const response = await fetch(`https://api.modpacks.ch/public/modpack/${pack}`);
        packData = await response.json();
        // 将获取到的数据缓存到localStorage中
        cachedPacks[pack] = packData;
        localStorage.setItem('cachedPacks', JSON.stringify(cachedPacks));
      }

      // 模组加载器不显示在列表
      const keywords = ["NeoForge", "Fabric", "Vanilla", "MinecraftForge"];
      if (!keywords.some(keyword => packData.name==keyword)) {
        progress.value += 1
        allPacks.push(packData);
      }
    });
  
    await Promise.allSettled(fetches);
    displayPacks(true);
  }

  function doSearch(input) {
    const lowerCaseInput = input.toLowerCase();
    const packElements = Array.from(packList.children);
  
    packElements.forEach(packEl => {
      const packName = packEl.children[0].textContent.toLowerCase();
      const isVisible = lowerCaseInput === '' || packName.includes(lowerCaseInput);
      packEl.classList.toggle('is-hidden', !isVisible);
    });
  }
  
  function displayPacks(displayFirst = false) {
    if (!allPacks.length) return;

    packList.textContent = '';
    allPacks.sort((a, b) => {
      if (filter.value === 'name') {
        return a.name.replace('FTB ', '').localeCompare(b.name.replace('FTB ', ''));
      }
      return b[filter.value] - a[filter.value];
    });

    const fragment = document.createDocumentFragment();
    allPacks.forEach(pack => {
      const packLink = document.createElement("a");
      packLink.href = `javascript:void(0)`; // 防止页面跳转
      packLink.textContent = pack.name;
      packLink.addEventListener('click', () => displayPack(pack.id)); // 绑定点击事件

      const listItem = document.createElement("li");
      listItem.appendChild(packLink);

      fragment.appendChild(listItem);
    });
    packList.appendChild(fragment);
    
    modal.classList.remove("is-active");

    if (displayFirst && allPacks.length > 0) {
      displayPack(allPacks[0].id);
    }

    doSearch(search.value);
  }

  const packHero = document.getElementById("pack-hero");
  const packName = document.getElementById("pack-name");
  const packDesc = document.getElementById("pack-desc");
  const versionList = document.getElementById("version-list");

  async function displayPack(packId) {
    const response = await fetch(`https://api.modpacks.ch/public/modpack/${packId}`);
    const data = await response.json();

    versionList.textContent = '';
    packHero.style.backgroundImage = "";
    packName.textContent = data.name;
    packDesc.textContent = data.synopsis;

    const styles = {
      color: "#ffffff",
      background: "rgba(0, 0, 0, 0.5)",
      padding: "10px",
      borderRadius: "5px"
    };
    Object.assign(packName.style, styles);
    Object.assign(packDesc.style, styles);

    // 设置背景图片
    const splashArt = data.art.find(art => art.type === "splash");
    if (splashArt) {
      Object.assign(packHero.style, {
        backgroundImage: `url(${splashArt.url})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      });
    }

    // 创建版本列表
    const fragment = document.createDocumentFragment();
    data.versions.reverse().forEach(version => {
      const listItem = document.createElement("li");
      listItem.style.display = 'flex';
      listItem.style.alignItems = 'center';
      listItem.style.padding = '10px';
      listItem.style.borderBottom = '1px solid #ccc';
      listItem.style.cursor = 'pointer';

      const icon = document.createElement("span");
      icon.className = "icon is-medium";
      icon.innerHTML = '<i class="fas fa-download"></i>';
      icon.style.fontSize = '1.5em';
      icon.style.marginRight = '10px';

      const link = document.createElement("a");
      link.href = `javascript:void(0)`;

      // 将时间戳转换为年月日格式
      const timestamp = new Date(version.updated * 1000); // 转换为毫秒
      const formattedDate = `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}-${timestamp.getDate()}`;
      link.textContent = `${version.name} (${formattedDate})`; // 添加年月日

      link.style.fontSize = '1.2em';
      link.style.flexGrow = '1';
      link.style.textDecoration = 'none';
      link.style.color = '#3273dc';

      // 让点击整个列表项也触发下载
      listItem.addEventListener('click', () => displayPackVersion(packId, version.id));

      listItem.appendChild(icon);
      listItem.appendChild(link);
      fragment.appendChild(listItem);
    });
    versionList.appendChild(fragment);
  }

  function displayPackVersion(packId, versionId) {
    const headers = new Headers({
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": `modpacklauncher/@vmct ${navigator.userAgent}`
    });

    fetch(`https://api.modpacks.ch/public/modpack/${packId}`)
      .then(response => response.json())
      .then(packData => {
        fetch(`https://api.modpacks.ch/public/modpack/${packId}/${versionId}`, {
          method: 'GET',
          headers
        })
          .then(response => response.json())
          .then(versionData => {
            const modrinth = {
              formatVersion: 1,
              game: 'minecraft',
              versionId: versionData.name,
              name: packData.name,
              summary: packData.synopsis,
              files: [],
              dependencies: {},
            };

            versionData.targets.forEach(target => {
              if (['minecraft', 'forge', 'fabric', 'neoforge'].includes(target.name)) {
                modrinth.dependencies[target.name === 'fabric' ? 'fabric-loader' : target.name] = target.version;
              }
            });

            versionData.files.forEach(file => {
              if (file.path.includes('ftbauxilium')) return;
            
              let url = file.url || (file.curseforge && 
                `https://media.forgecdn.net/files/${String(file.curseforge.file).substring(0, 4)}
                /${String(file.curseforge.file).substring(4, 7).replace(/^0+/, '')}
                /${encodeURIComponent(file.name)}`);
              
              modrinth.files.push({
                path: `${file.path}${file.name}`,
                hashes: { sha1: file.sha1 },
                env: {
                  client: file.serveronly ? 'unsupported' : 'required',
                  server: file.clientonly ? 'unsupported' : 'required',
                },
                downloads: [url],
                fileSize: file.size,
              });
            });
            
            const zip = new JSZip();
            zip.file("modrinth.index.json", JSON.stringify(modrinth, null, 2));
            zip.generateAsync({ type: "blob" }).then(blob => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = `${packData.name}-${versionData.name}.mrpack`;
              document.body.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              document.body.removeChild(a);
            })
          });
      });
  }
});
