'use strict'

// ~~~ * Data * ~~~ \\

const NpcData = require('./data/npcData.json'),
	SkillData = require('./data/skillString.json'),
	{ ImportantAbns, BlockedAbns, ReplaceAbnIds, AbnNoEffectInvisibleNpcSpamId } = require('./data/abnormalities.json'),
	{ UserNpcs, TrapsIds, FireWorks, UserNpcsHzId, SmokeBombId, DivineWrathId, MoteIds } = require('./data/userSpawns.json'),
	ImportantProjectiles = { ...SmokeBombId, ...DivineWrathId },
	{ InvisibleNpcs, SpamAchIds, PClasses, PRoles, HexColors, Alphabet, StarterWeaponIds, InvalidVoiceId, MountToReplaceId, ImportantActionScripts } = require('./data/miscData.json'),
	{ BnzC, SlvC, GldC, PnkC, HPkC, CPkC, RedC, GrnC, LPrC, PrpC, LBlC, BluC, DBlC, HBlC, GryC, YlwC } = HexColors;

const LastHook = { order: 100010 },
	LastHookfn = { order: 100010, filter: { fake: null, silenced: false, modified: null } };

module.exports = function FpsUtils(mod) {

	// ~~~ * Constants * ~~~ \\

	const Cfg = mod.settings,
		Cmd = mod.command,
		NotCP = typeof mod.compileProto !== 'undefined';

	// ~~~ * Variables * ~~~ \\

	let MyName = '',
		MyGameId = -1n,
		AllowedAchUps = 0,
		LastVrange = 0,
		LastFState = null,
		LastGState = null,
		SwitchCd = false,
		ProjDebug = false,
		AbnDebug = false,
		TmpData = [],
		PMembers = new Set(),
		BProjectiles = new Set(),
		SUsers = {},
		HUsers = {},
		SNpcs = {},
		HNpcs = {},
		SPets = {},
		HPets = {},
		HSeedBoxes = new Set();

	// ~~~ * Gui Parser * ~~~ \\

	const Xmap = new WeakMap();

	if (!Xmap.has(mod.dispatch || mod)) {
		Xmap.set(mod.dispatch || mod, {});

		mod.hook('C_CONFIRM_UPDATE_NOTIFICATION', 'raw', LastHook, () => false);

		mod.hook('C_ADMIN', 1, LastHookfn, (event) => {
			const commands = event.command.split(";");
			for (const cmd of commands)
				try { Cmd.exec(cmd); } catch (err) { continue; }
			return false;
		});
	}

	const gui = {
		parse(Xarray, title, body = '') {
			for (const data of Xarray) {
				if (body.length >= 16E3) {
					body += 'Se excedió el límite de datos de la interfaz gráfica de usuario, es posible que falten algunos valores.';
					break;
				}
				if (data.command) body += `<a href="admincommand:/@${data.command}">${data.text}</a>`;
				else if (!data.command) body += `${data.text}`;
				else continue;
			}
			mod.toClient('S_ANNOUNCE_UPDATE_NOTIFICATION', 1, { id: 0, title, body });
		}
	};

	// ~~~ * Gui Handler * ~~~ \\

	function GuiHandler(page, arg) {
		switch (page) {
			case "searchnpc": case "npcsearch":
				NpcJsonSearch("search", arg);
				break;
			case "npc":
				NpcJsonSearch("starts", arg);
				break;
			case "npclist":
				TmpData.push(
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br><br>`, command: "fps gui" },
					{ text: `<font color="${YlwC}" size="+20"><p align="right">[Pagina principal de NPC]</p></font><br>`, command: "fps gui npcmain" },
					{ text: `<font color="${LBlC}" size="+19">Haga clic en una ID de NPC para eliminarla de la lista negra:</font><br>` }
				);
				for (const blNpc of Cfg.NpcsBlacklist) TmpData.push({ text: `<font color="${BnzC}" size="+17">${blNpc.zone}, ${blNpc.templateId}</font><br>`, command: `fps npc hide ${blNpc.zone} ${blNpc.templateId};fps gui npclist` });
				gui.parse(TmpData, `<font color="${LPrC}">[FPS] Opciones - NPCs </font><font color="${GrnC}">(Lista Negra)</font>`);
				break;
			case "npcmain":
				TmpData.push(
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br><br>`, command: "fps gui" },
					{ text: `<font color="${YlwC}" size="+20"><p align="right">[Lista de NPC en la lista negra]</p></font><br>`, command: "fps gui npclist" },
					{ text: `<font color="${LBlC}" size="+19">Haga clic en una letra para ver todos los NPC que comienzan con esa letra:<br><br>` }
				);
				for (const i of Alphabet.split('')) TmpData.push({ text: `<font color="${BluC}" size="+19">${i}</font>`, command: `fps gui npc ${i}` }, { text: "&nbsp;&nbsp;" });
				TmpData.push(
					{ text: `<br><br><font color="${PnkC}" size="+16">(Comando </font><font color="${HPkC}" size="+16">"fps gui searchnpc &#60;name&#62;"</font><font color="${PnkC}" size="+16"> para buscar nombres de NPC específicos, distingue entre mayúsculas y minúsculas)</font>` },
					{ text: `<br><br><font color="${PnkC}" size="+16">(Comando </font><font color="${HPkC}" size="+16">"fps gui npc &#60;letters&#62;"</font><font color="${PnkC}" size="+16"> para buscar nombres de NPC que comiencen con esas 'letras', distingue entre mayúsculas y minúsculas)</font>` },
					{ text: `<br><br><font color="${PnkC}" size="+16">Si desea buscar npc con espacio entre su nombre, debe agregar el nombre completo entre comillas, ejem. <font color="${HPkC}" size="+16">fps gui npcsearch "Bay Kamara"\`</font></font>` }
				);
				gui.parse(TmpData, `<font color="${LPrC}">[FPS] Opciones - NPCs </font><font color="${YlwC}">(Principal)</font>`);
				break;
			case "show":
				TmpData.push(
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br>`, command: "fps gui" },
					{ text: `<font color="${YlwC}" size="+20"><p align="right">[Actualizar]</p></font><br>`, command: "fps gui show" },
					{ text: `<font color="${RedC}" size="+16">Rojo</font><font color="${LPrC}" size="+16"> = Mostrado, <font color="${GrnC}" size="+16">Verde</font><font color="${LPrC}" size="+16"> = Oculto</font></font><br>` },
					{ text: `<font color="${PnkC}" size="+16">(Comando </font><font color="${HPkC}" size="+16">"fps hide &#60;name&#62;"</font><font color="${PnkC}" size="+16"> ocultar a alguien que no aparece aqui)</font><br><br>` },
					{ text: `<font color="${LBlC}" size="+19">Haga clic en <font color="${RedC}">Rojo</font> para ocultar y agregar a la lista negra.<br>Haga clic en <font color="${GrnC}">Verde</font> para mostrar y eliminar de la lista negra</font><br>` }
				);
				for (const sUser in SUsers) TmpData.push({ text: `<font color="${Cfg.PlayersBlacklist.indexOf(SUsers[sUser].name.toLowerCase()) !== -1 ? GrnC : RedC}" size="+17">${SUsers[sUser].name}</font><br>`, command: Cfg.PlayersBlacklist.indexOf(SUsers[sUser].name.toLowerCase()) !== -1 ? `fps show ${SUsers[sUser].name};fps gui show` : `fps hide ${SUsers[sUser].name};fps gui show` });
				gui.parse(TmpData, `<font color="${LPrC}">[FPS] Opciones - Jugadores </font><font color="${RedC}">(En distancia)</font>`);
				break;
			case "hide":
				TmpData.push(
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br><br>`, command: "fps gui" },
					{ text: `<font color="${LBlC}" size="+19">Haga clic para mostrar y eliminar de la lista negra.</font><br>` }
				);
				Cfg.PlayersBlacklist.forEach(el => TmpData.push({ text: `<font color="${BnzC}" size="+17">${el}</font><br>`, command: `fps show ${el};fps gui hide` }));
				gui.parse(TmpData, `<font color="${LPrC}">[FPS] Opciones - Jugadores </font><font color="${GrnC}">(Oculto)</font>`);
				break;
			case "skills":
				gui.parse([
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br>`, command: "fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Tankers:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Lancer&#41;</font>`, command: "fps gui class lancer" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Brawler&#41;</font><br><br>`, command: "fps gui class brawler" },
					{ text: `<font color="${YlwC}" size="+20">Healers:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Priest&#41;</font>`, command: "fps gui class priest" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Mystic&#41;</font><br><br>`, command: "fps gui class mystic" },
					{ text: `<font color="${YlwC}" size="+20">Dpsers(melee):</font>` }, { text: "&#09;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Warrior&#41;</font>`, command: "fps gui class warrior" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Slayer&#41;</font>`, command: "fps gui class slayer" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Berserker&#41;</font>`, command: "fps gui class berserker" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Ninja&#41;</font>`, command: "fps gui class ninja" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Valkyrie&#41;</font>`, command: "fps gui class valkyrie" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Reaper&#41;</font><br><br>`, command: "fps gui class reaper" },
					{ text: `<font color="${YlwC}" size="+20">Dpsers(a distancia):</font>` }, { text: "&#09;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Sorcerer&#41;</font>`, command: "fps gui class sorcerer" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Archer&#41;</font>`, command: "fps gui class archer" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">&#40;Gunner&#41;</font>`, command: "fps gui class gunner" }
				], `<font color="${LPrC}">[FPS] Opciones - Habilidades </font><font color="${YlwC}">(Elegir por Clase)</font>`);
				break;
			case "class":
				gui.parse(SkillJsonSearch(arg), `<font color="${LPrC}">[FPS] Opciones - Lista de habilidades para '${arg}'</font>`);
				break;
			case "role":
				gui.parse([
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br><br>`, command: "fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Por Roles:</font>` }, { text: "&#09;" },
					{ text: `<font color="${Cfg.RolesBlacklist.includes('tank') ? GrnC : RedC}" size="+18">[Tankers]</font>`, command: `fps ${Cfg.RolesBlacklist.includes('tank') ? "show" : "hide"} tank;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.RolesBlacklist.includes('healer') ? GrnC : RedC}" size="+18">[Healers]</font>`, command: `fps ${Cfg.RolesBlacklist.includes('healer') ? "show" : "hide"} healer;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.RolesBlacklist.includes('dps') ? GrnC : RedC}" size="+18" >[Dps-Todos]</font>`, command: `fps ${Cfg.RolesBlacklist.includes('dps') ? "show" : "hide"} dps;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.RolesBlacklist.includes('ranged') ? GrnC : RedC}" size="+18">[Dps-a distancia]</font><br><br><br><br>`, command: `fps ${Cfg.RolesBlacklist.includes('ranged') ? "show" : "hide"} ranged;fps gui role` },
					{ text: `<font color="${DBlC}" size="+22">Por Clases</font><br><br>` },
					{ text: `<font color="${YlwC}" size="+20">Tankers:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('lancer') ? GrnC : RedC}" size="+18">[Lancer]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('lancer') ? "show" : "hide"} lancer;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('brawler') ? GrnC : RedC}" size="+18">[Brawler]</font><br><br>`, command: `fps ${Cfg.ClassesBlacklist.includes('brawler') ? "show" : "hide"} brawler;fps gui role` },
					{ text: `<font color="${YlwC}" size="+20">Healers:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('priest') ? GrnC : RedC}" size="+18">[Priest]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('priest') ? "show" : "hide"} priest;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('mystic') ? GrnC : RedC}" size="+18">[Mystic]</font><br><br>`, command: `fps ${Cfg.ClassesBlacklist.includes('mystic') ? "show" : "hide"} mystic;fps gui role` },
					{ text: `<font color="${YlwC}" size="+20">Dpsers(melee):</font>` }, { text: "&#09;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('warrior') ? GrnC : RedC}" size="+18">[Warrior]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('warrior') ? "show" : "hide"} warrior;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('slayer') ? GrnC : RedC}" size="+18">[Slayer]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('slayer') ? "show" : "hide"} slayer;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('berserker') ? GrnC : RedC}" size="+18">[Berserker]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('berserker') ? "show" : "hide"} berserker;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('ninja') ? GrnC : RedC}" size="+18">[Ninja]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('ninja') ? "show" : "hide"} ninja;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('valkyrie') ? GrnC : RedC}" size="+18">[Valkyrie]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('valkyrie') ? "show" : "hide"} valkyrie;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('reaper') ? GrnC : RedC}" size="+18">[Reaper]</font><br><br>`, command: `fps ${Cfg.ClassesBlacklist.includes('reaper') ? "show" : "hide"} reaper;fps gui role` },
					{ text: `<font color="${YlwC}" size="+20">Dpsers(ranged):</font>` }, { text: "&#09;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('sorcerer') ? GrnC : RedC}" size="+18">[Sorcerer]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('sorcerer') ? "show" : "hide"} sorcerer;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('archer') ? GrnC : RedC}" size="+18">[Archer]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('archer') ? "show" : "hide"} archer;fps gui role` }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ClassesBlacklist.includes('gunner') ? GrnC : RedC}" size="+18">[Gunner]</font>`, command: `fps ${Cfg.ClassesBlacklist.includes('gunner') ? "show" : "hide"} gunner;fps gui role` }
				], `<font color="${LPrC}">[FPS] Opciones - Roles/Clases</font>`);
				break;
			case "abn":
				TmpData.push(
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br>`, command: "fps gui" },
					{ text: `<font color="${AbnDebug ? GrnC : RedC}" size="+19"><p align="right">Depurar</p></font><br>`, command: "fps abn log;fps gui abn" },
					{ text: `<font color="${LPrC}" size="+19">Lista negra: </font><font color="${PnkC}" size="17+">Haga clic para eliminar de la lista negra.</font><br>` }
				);
				Cfg.AbnormalitiesBlacklist.forEach(el => TmpData.push({ text: `<font color="${BnzC}" size="+16">${el}<br></font>`, command: `fps abn blacklist remv ${el};fps gui abn` }));
				gui.parse(TmpData, `<font color="${LPrC}">[FPS] Opciones - Anomalías</font>`);
				break;
			case "proj":
				TmpData.push(
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br>`, command: "fps gui" },
					{ text: `<font color="${ProjDebug ? GrnC : RedC}" size="+19"><p align="right">Depurar</p></font><br>`, command: "fps proj log;fps gui proj" },
					{ text: `<font color="${LPrC}" size="+19">Lista negra: </font><font color="${PnkC}" size="17+">Haga clic para eliminar de la lista negra.</font><br>` }
				);
				Cfg.ProjectilesBlacklist.forEach(el => TmpData.push({ text: `<font color="${BnzC}" size="+16">${el}<br></font>`, command: `fps proj blacklist remv ${el};fps gui proj` }));
				gui.parse(TmpData, `<font color="${LPrC}">[FPS] Opciones - Proyectiles</font>`);
				break;
			case "help":
				gui.parse([
					{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br>`, command: "fps gui" },
					{ text: `<font size="20"><font color="${LBlC}">Comando</font>            <font color="${SlvC}">Argumento(s)</font>                 <font color="${CPkC}">Ejemplo</font><br>` },
					{ text: `<font color="${HBlC}">gui ^ g</font>                      <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps gui</font><br>` },
					{ text: `<font color="${HBlC}"> N/A </font>                         <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps-util</font><br>` },
					{ text: `<font color="${HBlC}">0 ^ 1 ^ 2 ^ 3</font>              <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!0 ^ !1 ^ !2 ^ !3</font><br>` },
					{ text: `<font color="${HBlC}">mode</font>                  <font color="${DBlC}">0 ^ 1 ^ 2 ^ 3</font>            <font color="${HPkC}">!fps mode 2</font><br>` },
					{ text: `<font color="${HBlC}">hide^show</font>    <font color="${DBlC}">Player^Class^Role</font>      <font color="${HPkC}">!fps hide mie</font><br>` },
					{ text: `<font color="${HBlC}">party</font>                         <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps party</font><br>` },
					{ text: `<font color="${HBlC}">raid</font>                           <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps raid</font><br>` },
					{ text: `<font color="${HBlC}">list</font>                            <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps list</font><br>` },
					{ text: `<font color="${HBlC}">sums</font>                 <font color="${DBlC}">other ^ me</font>               <font color="${HPkC}">!fps sums me</font><br>` },
					{ text: `<font color="${HBlC}">skill</font>                       <font color="${DBlC}">blacklist</font>               <font color="${HPkC}">!fps skill blacklist</font><br>` },
					{ text: `<font color="${HBlC}">npc</font>                      <font color="${DBlC}">N/A ^ hide</font>             <font color="${HPkC}">!fps npc</font><br>` },
					{ text: `<font color="${HBlC}">hit</font>                  <font color="${DBlC}">me^other^damage</font>    <font color="${HPkC}">!fps hit me</font><br>` },
					{ text: `<font color="${HBlC}">firework</font>                 <font color="${DBlC}">N/A</font>                     <font color="${HPkC}">!fps firework</font><br>` },
					{ text: `<font color="${HBlC}">abn</font>                   <font color="${DBlC}">all ^ blacklist</font>          <font color="${HPkC}">!fps abn blacklist</font><br>` },
					{ text: `<font color="${HBlC}">proj</font>                   <font color="${DBlC}">all ^ blacklist</font>          <font color="${HPkC}">!fps proj all</font><br>` },
					{ text: `<font color="${HBlC}">guildlogo</font>                <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps guildlogo</font><br>` },
					{ text: `<font color="${HBlC}">style</font>                        <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps style</font><br>` },
					{ text: `<font color="${HBlC}">gui npcsearch</font>      <font color="${DBlC}">"target"</font>                <font color="${HPkC}">!fps gui npcsearch E</font><br>` },
					{ text: `<font color="${HBlC}">npczoom</font>                 <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps npczoom</font><br>` },
					{ text: `<font color="${HBlC}">dropitem</font>                 <font color="${DBlC}">N/A ^ hide</font>        <font color="${HPkC}">!fps dropitem</font><br>` },
					{ text: `<font color="${HBlC}">monsterdeathani</font>   <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps monsterdeathani</font><br>` },
					{ text: `<font color="${HBlC}">screenabns</font>             <font color="${DBlC}">N/A ^  hide</font>       <font color="${HPkC}">!fps screenabns</font><br>` },
					{ text: `<font color="${HBlC}">hpnumbers</font>             <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps hpnumbers</font><br>` },
					{ text: `<font color="${HBlC}">mpnumbers</font>            <font color="${DBlC}">N/A</font>                    <font color="${HPkC}">!fps mpnumbers</font><br>` },
					{ text: `<font color="${HBlC}">pet</font>                          <font color="${DBlC}">N/A</font>                     <font color="${HPkC}">!fps raid</font><br>` },
					{ text: `<font color="${HBlC}">guardian</font>                <font color="${DBlC}">N/A</font>                      <font color="${HPkC}">!fps guardian</font><br>` },
					{ text: `<font color="${HBlC}">muteothers</font>            <font color="${DBlC}">N/A</font>                      <font color="${HPkC}">!fps muteothers</font><br>` },
					{ text: `<font color="${HBlC}">stream</font>                   <font color="${DBlC}">N/A</font>                      <font color="${HPkC}">!fps stream</font></font><br>` },
				], `<font color="${LPrC}">[FPS] AYUDA</font>`);
				break;
			default:
				gui.parse([
					{ text: `<font color="${PrpC}" size="+15"><p align="right">ACTUALIZAR</p></font><br>`, command: "fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Modos:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${Cfg.Mode === 0 ? GrnC : RedC}" size="+18">[Modo 0]</font>`, command: "fps mode 0;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.Mode === 1 ? GrnC : RedC}" size="+18">[Modo 1]</font>`, command: "fps mode 1;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.Mode === 2 ? GrnC : RedC}" size="+18">[Modo 2]</font>`, command: "fps mode 2;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.Mode === 3 ? GrnC : RedC}" size="+18">[Modo 3]</font><br><br>`, command: "fps mode 3;fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Hit:</font>` }, { text: "&#09;&#09;&#09;" },
					{ text: `<font color="${Cfg.Hit_Other ? GrnC : RedC}" size="+18">[Jugadores]</font>`, command: "fps hit other;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.Hit_Me ? GrnC : RedC}" size="+18">[Propio]</font>`, command: "fps hit me;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.Hit_Damage ? GrnC : RedC}" size="+18">[Numeros de Daño/Heal]</font>`, command: "fps hit damage;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.Hit_All ? GrnC : RedC}" size="+18">[TODOS]</font><br><br>`, command: "fps hit all;fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Esconder:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${LBlC}" size="+18">[Clases/Roles]</font>`, command: "fps gui role" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ShowStyle ? GrnC : RedC}" size="+18">[Estilo]</font>`, command: "fps style;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.Hideguildlogos ? GrnC : RedC}" size="+18">[Logotipos de Guild]</font>`, command: "fps guildlogo;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideFireworks ? GrnC : RedC}" size="+18">[Fuegos Artificiales]</font>`, command: "fps fireworks;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideServantBalloons ? GrnC : RedC}" size="+18">[Ventana Emergente de Mascotas]</font><br><br>`, command: "fps petspopup;fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Uno mismo (propio):</font>` }, { text: "&#09;" },
					{ text: `<font color="${Cfg.HideHpNumbers ? GrnC : RedC}" size="+18">[Números de HP]</font>`, command: "fps hpnumbers;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideMpNumbers ? GrnC : RedC}" size="+18">[Números de MP]</font>`, command: "fps mpnumbers;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideMySummons ? GrnC : RedC}" size="+18">[Convocatoria Propia]</font>`, command: "fps summons me;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideMyServants ? GrnC : RedC}" size="+18">[Mascotas]</font>`, command: "fps pet me;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideOwnBlacklistedAbns ? GrnC : RedC}" size="+18">[Borroso/Mareado]</font><br>`, command: "fps screenabns;fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Jugadores:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${LBlC}" size="+18">[Lista Generada]</font>`, command: "fps gui show" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">[Lista Oculta]</font>`, command: "fps gui hide" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideOthersSummons ? GrnC : RedC}" size="+18">[Convocatoria de Jugadores]</font>`, command: "fps summons;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideOthersServants ? GrnC : RedC}" size="+18">[Mascotas]</font><br>`, command: "fps pet;fps gui" },
					{ text: `<font color="${YlwC}" size="+20">NPCs:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${LBlC}" size="+18">[Menú]</font>`, command: "fps gui npcmain" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideMonsterDeathAnimation ? GrnC : RedC}" size="+18">[Ocultar Animación de Muerte]</font>`, command: "fps monsterdeathani;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.ActionScripts ? GrnC : RedC}" size="+18">[Zoom-ins]</font>`, command: "fps npczoom;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideBlacklistedNpcs ? GrnC : RedC}" size="+18">[Ocultar en la lista negra]</font><br><br>`, command: "fps npc;fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Habilidades:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${LBlC}" size="+18">[Ocultar individualmente]</font>`, command: "fps gui skills" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideBlacklistedSkills ? GrnC : RedC}" size="+18">[Ocultar en la lista negra]</font><br>`, command: "fps skill blacklist;fps gui" },
					{ text: `<font color="${YlwC}" size="+20">Anormalidad:</font>` }, { text: "&#09;" },
					{ text: `<font color="${Cfg.HideAllAbnormalities ? GrnC : RedC}" size="+18">[Ocultar todo]</font>`, command: "fps abn all;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideBlacklistedAbnormalities ? GrnC : RedC}" size="+18">[Ocultar en la lista negra]</font>`, command: "fps abn blacklist;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">[Lista negra]</font><br>`, command: "fps gui abn" },
					{ text: `<font color="${YlwC}" size="+20">Proyectil:</font>` }, { text: "&#09;" },
					{ text: `<font color="${Cfg.HideAllProjectiles ? GrnC : RedC}" size="+18">[Ocultar todo]</font>`, command: "fps proj all;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideBlacklistedProjectiles ? GrnC : RedC}" size="+18">[Ocultar en la lista negra]</font>`, command: "fps proj blacklist;fps gui" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${LBlC}" size="+18">[Lista negra]</font><br><br>`, command: "fps gui proj" },
					{ text: `<font color="${YlwC}" size="+20">Varios.</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${Cfg.RaidAutoChange ? GrnC : RedC}" size="+18">[Estado automático de Raid]</font>`, command: "fps raid;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.OnlyParty ? GrnC : RedC}" size="+18">[Solo Party]</font>`, command: "fps party;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.HideBlacklistedDrop ? GrnC : RedC}" size="+18">[Drops Lista]</font>`, command: "fps dropitem;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.PvpTraps ? GrnC : RedC}" size="+17">[Mostrar trampas]</font><br>`, command: "fps pvptraps;fps gui" }, { text: "&#09;&#09;&#09;" },
					{ text: `<font color="${Cfg.GuardianAutoChange ? GrnC : RedC}" size="+17">[Estado automático del Guardian]</font>`, command: "fps guardian;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.MuteOthersVoice ? GrnC : RedC}" size="+17">[Silenciar la voces de otros]</font>`, command: "fps muteothers;fps gui" }, { text: "&nbsp;&nbsp;" },
					{ text: `<font color="${Cfg.StreamMode ? GrnC : RedC}" size="+17">[Stream]</font><br><br>`, command: "fps stream;fps gui" },
					{ text: `<font color="${BluC}" size="+22">Enlaces Rápidos:</font><br>` },
					{ text: `<font color="${YlwC}" size="+20">UI:</font>` }, { text: "&#09;&#09;" },
					{ text: `<font color="${PrpC}" size="+17">[Correo]</font>`, command: "fps quicklink parcel" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${PrpC}" size="+17">[Broker]</font>`, command: "fps quicklink broker" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${PrpC}" size="+17">[Talento]</font>`, command: "fps quicklink talents" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${PrpC}" size="+17">[Ropa]</font>`, command: "fps quicklink dressingroom" }, { text: "&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${PrpC}" size="+17">[Estilo de Sombrero]</font><br>`, command: "fps quicklink hatrestyle" },
					{ text: `<font color="${YlwC}" size="+20">Party:</font>` }, { text: "&#09;" },
					{ text: `<font color="${CPkC}" size="+18">[Reiniciar]</font>`, command: "fps quicklink reset" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${CPkC}" size="+18">[Abandonar]</font>`, command: "fps quicklink drop" }, { text: "&nbsp;&nbsp;&nbsp;&nbsp;" },
					{ text: `<font color="${CPkC}" size="+18">[Disolver]</font><br>`, command: "fps quicklink disband" },
					{ text: `<font color="${YlwC}" size="+20">Sistema:</font>` }, { text: "&#09;" },
					{ text: `<font color="${CPkC}" size="+18">[Selección de Personajes]</font>`, command: "fps quicklink lobby" }, { text: "&#09;&#09;&#09;&#09;&#09;" },
					{ text: `<font color="${CPkC}" size="+18">[!! Salida Instantánea !!]</font><br>`, command: "fps quicklink instantexit" }
				], `<font color="${LPrC}">[FPS] Opciones</font> | <font color="${RedC}" size="+16">Rojo</font><font color="${LPrC}" size="+16"> = desactivado, <font color="${GrnC}" size="+16">Verde</font><font color="${LPrC}" size="+16"> = activado</font>`);
				break;
		}
		TmpData = [];
	}

	// ~~~ * Gui Functions * ~~~ \\

	function SkillJsonSearch(value) {
		let keys = [],
			skilldata = [],
			skillIds = [];
		skilldata.push(
			{ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br>`, command: "fps gui" },
			{ text: `<font color="${Cfg.HideBlacklistedSkills ? GrnC : RedC}" size="+22"><p align="right">[Las habilidades en la lista negra son ${Cfg.HideBlacklistedSkills ? 'Oculto' : 'Mostrado'}]</p></font><br>`, command: `fps skill blacklist;fps gui class ${value}` },
			{ text: `<font color="${LBlC}" size="+19">Haga clic en la habilidad para incluirla en la lista negra.</font><br>` }
		);
		for (const key in SkillData[value]) keys.push(key);
		skillIds.push(Object.values(SkillData[value]));
		for (let i = 0; i < keys.length; i++)
			skilldata.push({ command: `fps skill class ${value} ${skillIds[0][i]};fps gui class ${value}`, text: `<font color="${Cfg.ClassesData[ClassNameFromID(value)].CD_SkillsBlacklist.includes(skillIds[0][i].toString()) ? GrnC : RedC}" size="+17">[${keys[i]}]</font><br>` });
		return skilldata;
	}

	function NpcJsonSearch(type, arg) {
		TmpData.push({ text: `<font color="${PrpC}" size="+24"><p align="right">MENÚ PRINCIPAL</p></font><br><br>`, command: "fps gui" });
		for (const data of NpcData)
			if (type === 'starts' && data.Nm.startsWith(arg) || type === 'search' && data.Nm.includes(arg))
				TmpData.push({ command: `fps npc hide ${data.Hz} ${data.Ti};fps gui ${type === 'starts' ? 'npc' : 'npcsearch'} ${arg}`, text: `<font color="${Cfg.NpcsBlacklist.some(arrVal => data.Hz === arrVal.zone && data.Ti === arrVal.templateId) ? GrnC : RedC}" size="+17">${data.Nm}</font><br>` });
		gui.parse(TmpData, `<font color="${LPrC}">[FPS] Opciones - NPCs</font> | <font color="${LBlC}" size="+16">Resultados de búsqueda para '${arg}'</font>.`);
		TmpData = [];
	}

	function ClassNameFromID(name) {
		for (const cData of Object.keys(Cfg.ClassesData)) if (Cfg.ClassesData[cData].name === name) return cData;
	}

	// ~~~ * Command Functions * ~~~ \\

	function Msg(msg) {
		if (Cfg.StreamMode) return;
		Cmd.message(`<font color="${LPrC}">${NotCP ? '[FPS] ' : ''}${msg}</font>`);
	}

	function RemoveEntity(arr, elem) {
		if (elem.length)
			for (const [index, value] of arr.entries())
				if (value.toLowerCase() === elem.toLowerCase()) arr.splice(index, 1);
		return arr;
	}

	function ScaleUpEntity(gameId, scale) {
		mod.toClient('S_ABNORMALITY_SCALE_UP', 2, { gameId, scale, duration: 0 });
	}

	function HideSpecificPlayerByName(name) {
		for (const sUser in SUsers) {
			if (SUsers[sUser].name.toString().toLowerCase() === name.toLowerCase()) {
				mod.toClient('S_DESPAWN_USER', 3, { gameId: SUsers[sUser].gameId, type: 1 });
				HUsers[SUsers[sUser].gameId] = SUsers[sUser];
				break;
			}
		}
	}

	function HideSpecificNpcByHzTi(hz, ti) {
		for (const sNpc in SNpcs) {
			if (SNpcs[sNpc].huntingZoneId === hz && SNpcs[sNpc].templateId === ti) {
				mod.toClient('S_DESPAWN_NPC', 3, { gameId: SNpcs[sNpc].gameId, loc: SNpcs[sNpc].loc, type: 1, unk: 0 });
				HNpcs[SNpcs[sNpc].gameId] = SNpcs[sNpc];
				HNpcs[SNpcs[sNpc].gameId].spawnType = 1;
				HNpcs[SNpcs[sNpc].gameId].spawnScript = 0;
				break;
			}
		}
	}

	function HideSpecificNpcByGid(gameId) {
		mod.toClient('S_DESPAWN_NPC', 3, { gameId, loc: SNpcs[gameId].loc, type: 1, unk: 0 });
		HNpcs[gameId] = SNpcs[gameId];
		HNpcs[gameId].spawnType = 1;
		HNpcs[gameId].spawnScript = 0;
	}

	function HideNpcs(type, whose) {
		switch (type) {
			case 'own':
			case 'others':
				for (const sNpc in SNpcs)
					if ((type === 'own' && EqGid(SNpcs[sNpc].owner) || type === 'others' && !EqGid(SNpcs[sNpc].owner)) && UserNpcs.includes(SNpcs[sNpc].templateId) && SNpcs[sNpc].huntingZoneId === UserNpcsHzId) HideSpecificNpcByGid(SNpcs[sNpc].gameId);
				break;
			case 'bl':
				for (const sNpc in SNpcs)
					for (const blNpc of Cfg.NpcsBlacklist)
						if (SNpcs[sNpc].huntingZoneId === Number(blNpc.zone) && SNpcs[sNpc].templateId === Number(blNpc.templateId)) HideSpecificNpcByGid(SNpcs[sNpc].gameId);
				break;
			case 'pet':
				for (const sPet in SPets) {
					if (EqGid(SPets[sPet].ownerId) && whose === 'own') {
						UpdateNpcLoc(SPets[sPet], -1E2);
						ScaleUpEntity(SPets[sPet].gameId, 1E-3);
					}
					if (!EqGid(SPets[sPet].ownerId) && whose === 'others')
						mod.toClient('S_REQUEST_DESPAWN_SERVANT', 1, { gameId: SPets[sPet].gameId, despawnType: 1 });
					HPets[SPets[sPet].gameId] = SPets[sPet];
				}
				break;
			default: break;
		}
	}

	function HideAllPlayers() {
		if (Cfg.OnlyParty) return undefined;
		for (const sUser in SUsers) {
			mod.toClient('S_DESPAWN_USER', 3, { gameId: SUsers[sUser].gameId, type: 1 });
			HUsers[SUsers[sUser].gameId] = SUsers[sUser];
			HUsers[SUsers[sUser].gameId].spawnFx = 1;
		}
	}

	function ShowSpecificPlayerByName(name) {
		for (const hUser in HUsers) {
			if (HUsers[hUser].name.toString().toLowerCase() === name.toLowerCase()) {
				ModifyUserAppearance(HUsers[hUser]);
				mod.toClient('S_SPAWN_USER', 15, HUsers[hUser]);
				delete HUsers[hUser];
				break;
			}
		}
	}

	function ShowSpecificNpcByHzTi(hz, ti) {
		for (const hNpc in HNpcs) {
			if (HNpcs[hNpc].huntingZoneId === hz && HNpcs[hNpc].templateId === ti) {
				mod.toClient('S_SPAWN_NPC', 11, HNpcs[hNpc]);
				delete HNpcs[hNpc];
				break;
			}
		}
	}

	function ShowSpecificNpcByGid(gameId) {
		mod.toClient('S_SPAWN_NPC', 11, HNpcs[gameId]);
		delete HNpcs[gameId];
	}

	function ShowNpcs(type, whose) {
		switch (type) {
			case 'own':
			case 'others':
				for (const hNpc in HNpcs)
					if (type === 'own' && EqGid(HNpcs[hNpc].owner || type === 'others' && !EqGid(HNpcs[hNpc].owner)) && UserNpcs.includes(HNpcs[hNpc].templateId) && HNpcs[hNpc].huntingZoneId === UserNpcsHzId) ShowSpecificNpcByGid(HNpcs[hNpc].gameId);
				break;
			case 'bl':
				for (const hNpc in HNpcs)
					for (const blNpc of Cfg.NpcsBlacklist)
						if (HNpcs[hNpc].huntingZoneId === Number(blNpc.zone) && HNpcs[hNpc].templateId === Number(blNpc.templateId)) ShowSpecificNpcByGid(HNpcs[hNpc].gameId);
				break;
			case 'pet':
				for (const hPet in HPets) {
					if (EqGid(HPets[hPet].ownerId) && whose === 'own') {
						UpdateNpcLoc(HPets[hPet]);
						ScaleUpEntity(HPets[hPet].gameId, 1);
					}
					else if (!EqGid(HPets[hPet].ownerId) && whose === 'others')
						mod.toClient('S_REQUEST_SPAWN_SERVANT', 4, HPets[hPet]);
					delete HPets[hPet];
				}
				break;
			default: break;
		}
	}

	function ShowAllPlayers() {
		for (const hUser in HUsers) {
			ModifyUserAppearance(HUsers[hUser]);
			mod.toClient('S_SPAWN_USER', 15, HUsers[hUser]);
			delete HUsers[hUser];
		}
	}

	// ~~~ * Core Functions * ~~~ \\

	function ModifyUserAppearance(event) {
		let modified = undefined;

		if (Cfg.ShowStyle) {
			event.weapon = StarterWeaponIds[event.templateId % 1E2 - 1];
			event.body = event.hand = event.feet = event.underwear = event.head = event.face = 0;
			if (event.mount) event.mount = MountToReplaceId;
			event.title = 0;
			event.weaponDye = event.bodyDye = event.handDye = event.feetDye = event.weaponEnchant = 0;
			event.showFace = false;
			event.styleHead = event.styleFace = event.styleBack = event.styleWeapon = event.styleBody = 0;
			event.underwearDye = event.styleBackDye = event.styleHeadDye = event.styleFaceDye = 0;
			event.showStyle = false;
			event.styleFootprint = event.styleHeadScale = event.styleFaceScale = event.styleBackScale = 0;
			event.usedStyleHeadTransform = false;
			event.styleBodyDye = 0;
			event.icons = [];

			modified = true;
		}

		if (Cfg.Hideguildlogos) {
			event.guildLogo = '';
			event.guildLogoId = 0;

			modified = true;
		}

		if (Cfg.MuteOthersVoice) {
			event.appearance.voice = InvalidVoiceId;

			modified = true;
		}

		return modified;
	}

	function ModifyAbnormalities(event, end) {
		if (ImportantAbns.indexOf(event.id) !== -1) return undefined;

		if (ReplaceAbnIds[event.id]) {
			event.id = ReplaceAbnIds[event.id];

			return true;
		}

		if (!end) {
			if (typeof event.target === 'undefined') event.target = event.gameId

			if (EqGid(event.target)) {
				if (Cfg.HideOwnBlacklistedAbns && Cfg.OwnAbnormalsBlacklist.indexOf(event.id) !== -1) return false;

				return undefined;
			}

			if (HUsers[event.target] || HNpcs[event.target] || event.id === AbnNoEffectInvisibleNpcSpamId) return false;
			if (Cfg.HideBlacklistedAbnormalities && (Cfg.AbnormalitiesBlacklist.indexOf(event.id) !== -1 || BlockedAbns.indexOf(event.id) !== -1)) return false;
			if (Cfg.HideAllAbnormalities && (SUsers[event.target] || Cfg.AbnormalitiesBlacklist.indexOf(event.id) !== -1 || BlockedAbns.indexOf(event.id) !== -1)) return false;
		}
	}

	function ActionHCheck(event, end) {
		if (event.skill.npc) return;
		let hidden = false;

		if (EqGid(event.gameId) || !SUsers[event.gameId]) return undefined;

		if (Cfg.Mode >= 2 || HUsers[event.gameId] || Cfg.ClassesData[ClassID(event.templateId)].CD_HideBlacklistedSkills) hidden = true;
		if (Cfg.HideBlacklistedSkills && Cfg.ClassesData[ClassID(event.templateId)].CD_SkillsBlacklist.includes(Math.floor(event.skill.id / 1E4).toString())) hidden = true;

		if (hidden) UpdateUserLoc(event);

		if (HNpcs[event.gameId]) {
			HNpcs[event.gameId].loc = event.loc;

			hidden = true;
		}

		if (BProjectiles.has(event.id) && (Cfg.Mode >= 2 || Cfg.HideAllProjectiles)) hidden = true;

		return !end && hidden ? false : undefined;
	}

	function ProjectileBCheck(event) {
		if (event.skill.npc) return;
		if (typeof event.id === 'undefined') event.id = event.actionId;

		if (typeof event.skill !== 'undefined') {
			if (ImportantProjectiles[ClassID(event.templateId)] && ImportantProjectiles[ClassID(event.templateId)] === Math.floor(event.skill.id / 1E4) || (Cfg.PvpTraps && TrapsIds.includes(event.skill.id))) return undefined;
			if ((Cfg.HideBlacklistedProjectiles || Cfg.HideAllProjectiles) && Cfg.ProjectilesBlacklist.includes(event.skill.id)) BProjectiles.add(event.id);
		}

		if (typeof event.gameId !== 'undefined')
			if (!EqGid(event.gameId) && SUsers[event.gameId] && (HUsers[event.gameId] || Cfg.Mode >= 2 || Cfg.HideAllProjectiles)) BProjectiles.add(event.id);

		return BProjectiles.has(event.id) ? false : undefined;
	}

	function ModifySkillResult(event) {
		if (event.skill.npc) return;
		let returnValue = undefined;

		if (Cfg.Hit_Me && (EqGid(event.source) || EqGid(event.owner))) {
			event.templateId = 0;
			event.skill.id = 0;
			event.time = event.type = event.noctEffect = 0;
			event.crit = event.stackExplode = event.superArmor = false;
			event.superArmorId = event.hitCylinderId = 0;

			returnValue = true;
		}

		if (Cfg.Hit_Other && !EqGid(event.target) && !EqGid(event.source) && !EqGid(event.owner) && (SUsers[event.owner] || SUsers[event.source])) {
			event.templateId = 0;
			event.skill.id = 0;
			event.time = event.type = event.noctEffect = 0;
			event.crit = event.stackExplode = event.superArmor = false;
			event.superArmorId = event.hitCylinderId = 0;

			returnValue = true;
		}

		if (Cfg.Hit_Damage && (EqGid(event.source) || EqGid(event.owner) || EqGid(event.target) || UserNpcs.includes(event.templateId) && event.skill.huntingZoneId === UserNpcsHzId)) {
			event.value = 0n;

			returnValue = true;
		}

		if (Cfg.Hit_All) {
			event.templateId = 0;
			event.skill.id = 0;
			event.time = event.type = event.noctEffect = 0;
			event.value = 0n;
			event.crit = event.stackExplode = event.superArmor = false;
			event.superArmorId = event.hitCylinderId = 0;

			returnValue = true;
		}

		if (BProjectiles.has(event.id) && (Cfg.Mode >= 2 || Cfg.HideAllProjectiles)) returnValue = false;

		return returnValue;
	}

	const UserBCheck = user => { for (const plBlist of Cfg.PlayersBlacklist) if (plBlist.toLowerCase() === user.toLowerCase()) return true; };

	function NpcBCheck(event) {
		let blocked = false;

		if (Cfg.HideBlacklistedNpcs) {
			for (const blNpc of Cfg.NpcsBlacklist) {
				if (event.huntingZoneId === Number(blNpc.zone) && event.templateId === Number(blNpc.templateId)) {
					HNpcs[event.gameId] = event;
					HNpcs[event.gameId].spawnType = 1;
					HNpcs[event.gameId].spawnScript = 0;
					blocked = true;
					break;
				}
			}
		}

		if (InvisibleNpcs[event.huntingZoneId] && InvisibleNpcs[event.huntingZoneId].includes(event.templateId)) {
			HNpcs[event.gameId] = event;
			blocked = true;
		}

		if (Cfg.HideFireworks && event.huntingZoneId === UserNpcsHzId && FireWorks.includes(event.templateId)) {
			HNpcs[event.gameId] = event;
			blocked = true;
		}

		if (UserNpcs.includes(event.templateId) && event.huntingZoneId === UserNpcsHzId) {
			if (EqGid(event.owner) && Cfg.HideMySummons) {
				HNpcs[event.gameId] = event;
				HNpcs[event.gameId].spawnType = 1;
				HNpcs[event.gameId].spawnScript = 0;
				blocked = true;

			} else if (!EqGid(event.owner) && Cfg.HideOthersSummons) {
				HNpcs[event.gameId] = event;
				HNpcs[event.gameId].spawnType = 1;
				HNpcs[event.gameId].spawnScript = 0;
				blocked = true;
			}
		}

		return blocked ? false : undefined;
	}

	function updatePartySpawns(raid) {
		if (!Cfg.OnlyParty || !Cfg.RaidAutoChange) return

		if (Cfg.OnlyParty)
			for (const sUser in SUsers) {
				if (!PMembers.has(SUsers[sUser].name)) HideSpecificPlayerByName(SUsers[sUser].name);
				else if (HUsers[SUsers[sUser].gameId]) ShowSpecificPlayerByName(SUsers[sUser].name);
			}

		if (Cfg.RaidAutoChange && typeof raid !== 'undefined') {
			if (raid) {
				if (Cfg.Mode >= 2 || (LastFState === null && Cfg.Mode === 2)) return;
				LastFState = Cfg.Mode;
				Cmd.exec("fps state 2");
			} else {
				if (LastFState === null || Cfg.Mode !== 2) {
					LastFState = null;
					return;
				}
				Cmd.exec(`fps state ${LastFState}`);
				LastFState = null;
			}
		}
	}

	function EqGid(xG) {
		return (xG === MyGameId);
	}

	function ClassID(m) {
		return (m % 1E2);
	}

	function log(name, type, from, target, id) {
		console.log(`[\x1b[37m${new Date().toJSON().slice(11)}\x1b[39m] \x1b[91m->\x1b[39m \x1b[36m${name}\x1b[39m \x1b[35m${type}\x1b[39m \x1b[97m${from}\x1b[39m \x1b[32m'${target}'\x1b[39m: \x1b[94m\ID\x1b[39m "\x1b[31m${id}\x1b[39m\x1b[49m\x1b[0m"`);
	}

	function UpdateUserLoc(event) {
		mod.toClient('S_USER_LOCATION', 5, { gameId: event.gameId, loc: event.loc, w: event.w, speed: 3E2, dest: event.loc, type: 7 });
	}

	function UpdateNpcLoc(event, zMod = 0) {
		mod.toClient('S_NPC_LOCATION', 3, { gameId: event.gameId, loc: { x: event.loc.x, y: event.loc.y, z: event.loc.z + zMod }, w: event.w, speed: 3E2, dest: { x: event.loc.x, y: event.loc.y, z: event.loc.z + zMod }, type: 7 });
	}

	// ~~~ * Hook Functions * ~~~ \\

	function sLogin(event) {
		LastFState = event.name === MyName ? LastFState : null;
		LastGState = null;
		MyGameId = event.gameId;
		MyName = event.name;
		ProjDebug = false;
		AbnDebug = false;
		PMembers.clear();
		BProjectiles.clear();
		HSeedBoxes.clear();
		if (Cfg.StreamMode) console.log("\x1b[94mINFO\x1b[34m [FPS-UTILS]\x1b[39m - El modo Steam está habilitado, no se enviarán mensajes en el juego hasta que esté Desactivado.");
	}

	function sLoadTopo() {
		SUsers = {};
		SNpcs = {};
		HUsers = {};
		HNpcs = {};
		AllowedAchUps = 2;
		if (ProjDebug) {
			ProjDebug = false;
			Msg(`<font color="${HPkC}">Auto Desactivado</font> depuración de proyectiles, para reducir el spam innecesario.`);
		}
		if (AbnDebug) {
			AbnDebug = false;
			Msg(`<font color="${HPkC}">Auto Desactivado</font> depuración de anomalías, para reducir el spam innecesario.`);
		}
	}

	function sMountVehicle(event) {
		if (EqGid(event.gameId)) return;
		SUsers[event.gameId].mount = event.id;
		if (HUsers[event.gameId]) HUsers[event.gameId].mount = event.id;
		if (Cfg.ShowStyle) {
			event.id = MountToReplaceId;
			return true;
		}
	}

	function sUnmountVehicle(event) {
		if (EqGid(event.gameId)) return;
		SUsers[event.gameId].mount = 0;
		if (HUsers[event.gameId]) HUsers[event.gameId].mount = 0;
	}

	function cSetVisibleRange(event) {
		LastVrange = event.range;
	}

	function sStartCooltimeItem(event) {
		if (event.cooldown === 0) return false;
	}

	function sStartActionScript(event) {
		if (ImportantActionScripts.includes(event.script)) return;
		if (Cfg.ActionScripts) return false;
	}

	function sLoadingScreenControlInfo() {
		if (Cfg.Mode >= 2) return false;
	}

	function sUpdateAchievementProgress(event) {
		if (AllowedAchUps) {
			AllowedAchUps--;
			return;
		}
		if (Cfg.Mode < 2) return;
		for (const Achieve of event.achievements) if (SpamAchIds.indexOf(Achieve.id) !== -1 || !Achieve.requirements.length) return false;
	}

	function sItemCustomString(event) {
		if (event.customStrings.length === 0) return false;
	}

	function sSocial(event) {
		if (EqGid(event.target)) return;
		if (HUsers[event.target] || HNpcs[event.target]) return false;
	}

	function sGuildName(event) {
		if (Cfg.Hideguildlogos) {
			event.guildLogo = '';
			return true;
		}
	}

	function sApplyTitle(event) {
		if (EqGid(event.gameId)) return;
		if (Cfg.ShowStyle) return false;
	}

	function sImageData() {
		if (Cfg.Hideguildlogos) return false;
	}

	function sSpawnUser(event) {
		SUsers[event.gameId] = event;
		SUsers[event.gameId].spawnFx = 1;
		if (Cfg.Mode === 3 || UserBCheck(event.name) || Cfg.ClassesData[ClassID(event.templateId)].isHidden || (Cfg.OnlyParty && !PMembers.has(event.name))) {
			HUsers[event.gameId] = event;
			HUsers[event.gameId].spawnFx = 1;
			return false;
		}
		return ModifyUserAppearance(event);
	}

	function sSpawnUserfn(event) {
		return ModifyUserAppearance(event);
	}

	function sDespawnUser(event) {
		delete HUsers[event.gameId];
		delete SUsers[event.gameId];
	}

	function sUserLocation(event) {
		if (SUsers[event.gameId]) {
			SUsers[event.gameId].loc = event.dest;
			SUsers[event.gameId].w = event.w;
		}
		if (HUsers[event.gameId]) {
			HUsers[event.gameId].loc = event.dest;
			HUsers[event.gameId].w = event.w;
			return false;
		}
	}

	function sUserStatus(event) {
		if (SUsers[event.gameId]) SUsers[event.gameId].status = event.status;
		if (HUsers[event.gameId]) {
			HUsers[event.gameId].status = event.status;
			return false;
		}
	}

	function sDeadLocation(event) {
		if (SUsers[event.gameId]) SUsers[event.gameId].loc = event.loc;
		if (HUsers[event.gameId]) HUsers[event.gameId].loc = event.loc;
	}

	function sUserMovetype(event) {
		if (SUsers[event.gameId]) SUsers[event.gameId].w = event.w;
		if (HUsers[event.gameId]) {
			HUsers[event.gameId].w = event.w;
			return false;
		}
	}

	function sUserAppearanceChange(event) {
		if (EqGid(event.id)) return;
		if (Cfg.ShowStyle) return false;
	}

	function sUserChangeFaceCustom(event) {
		if (EqGid(event.gameId)) return;

		if (Cfg.MuteOthersVoice) {
			event.appearance.voice = InvalidVoiceId;
			return true;
		}
	}

	function sUserExternalChange(event) {
		if (EqGid(event.gameId)) return;
		if (Cfg.ShowStyle) return false;
	}

	function sUnicastTransformData(event) {
		if (EqGid(event.gameId) || !event.gameId) return;
		if (Cfg.ShowStyle) return false;

		let modified = undefined;

		if (Cfg.Hideguildlogos) {
			event.guildLogo = '';

			modified = true;
		}

		if (Cfg.MuteOthersVoice) {
			event.appearance.voice = InvalidVoiceId;

			modified = true;
		}

		return modified;
	}

	function sPartyMemberList(event) {
		event.members.map(value => { PMembers.add(value.name) });
		updatePartySpawns(event.raid);
	}

	function sLeavePartyMember(event) {
		PMembers.delete(event.name);
		updatePartySpawns();
	}

	function sLeaveParty() {
		PMembers.clear();
		updatePartySpawns(false);
	}

	function sSpawnNpc(event) {
		SNpcs[event.gameId] = event;
		SNpcs[event.gameId].spawnType = 1;
		SNpcs[event.gameId].spawnScript = 0;
		return NpcBCheck(event);
	}

	function sDespawnNpc(event) {
		delete HNpcs[event.gameId];
		delete SNpcs[event.gameId];
		if (!Cfg.HideMonsterDeathAnimation || event.type !== 5) return;
		event.type = 1;
		return true;
	}

	function sNpcLocation(event) {
		if (SNpcs[event.gameId]) {
			SNpcs[event.gameId].loc = event.dest;
			SNpcs[event.gameId].w = event.w;
		}
		if (SPets[event.gameId]) {
			SPets[event.gameId].loc = event.dest;
			SPets[event.gameId].w = event.w;
		}
		if (HPets[event.gameId]) {
			HPets[event.gameId].loc = event.dest;
			HPets[event.gameId].w = event.w;
			return false;
		}
		if (HNpcs[event.gameId]) {
			HNpcs[event.gameId].loc = event.dest;
			HNpcs[event.gameId].w = event.w;
			return false;
		}
	}

	function sCreatureLife(event) {
		if (SNpcs[event.gameId]) {
			SNpcs[event.gameId].loc = event.loc;
			SNpcs[event.gameId].alive = event.alive;
		}
		if (HNpcs[event.gameId]) {
			SNpcs[event.gameId].loc = event.loc;
			HNpcs[event.gameId].alive = event.alive;
		}
	}

	function sCreatureRotate(event) {
		if (SNpcs[event.gameId]) SNpcs[event.gameId].w = event.w;
		if (HNpcs[event.gameId]) {
			HNpcs[event.gameId].w = event.w;
			return false;
		}
	}

	function sFearMoveStage(event) {
		if ((!EqGid(event.gameId) && Cfg.Mode === 3) || HUsers[event.gameId] || HNpcs[event.gameId]) return false;
	}

	function sFearMoveEnd(event) {
		if ((!EqGid(event.gameId) && Cfg.Mode === 3) || HUsers[event.gameId] || HNpcs[event.gameId]) return false;
	}

	function sRequestSpawnServant(event) {
		SPets[event.gameId] = event;
		if (EqGid(event.ownerId) && Cfg.HideMyServants) {
			HPets[event.gameId] = event;
			process.nextTick(() => {
				UpdateNpcLoc(event, -1E2);
				ScaleUpEntity(event.gameId, 1E-3);
			});
		} else if (!EqGid(event.ownerId) && Cfg.HideOthersServants) {
			HPets[event.gameId] = event;
			return false;
		}
	}

	function sRequestDespawnServant(event) {
		delete HPets[event.gameId];
		delete SPets[event.gameId];
	}

	function sQuestBalloon(event) {
		if (!SPets[event.source]) return;
		if (Cfg.HideServantBalloons) return false;
	}

	function sAbnormalityBegin(event) {
		if (AbnDebug) {
			if (EqGid(event.target)) log('Abnormality', 'Applied', 'on', MyName, event.id);
			if (EqGid(event.source)) log('Abnormality', 'Started', 'from', MyName, event.id);
			if (SUsers[event.target]) log('Abnormality', 'Applied', 'on', SUsers[event.target].name, event.id);
			if (SUsers[event.source]) log('Abnormality', 'Started', 'from', SUsers[event.source].name, event.id);
		}
		return ModifyAbnormalities(event);
	}

	function sAbnormalityRefresh(event) {
		return ModifyAbnormalities(event);
	}

	function sAbnormalityResist(event) {
		return ModifyAbnormalities(event);
	}

	function sAbnormalityDamageAbsorb(event) {
		return ModifyAbnormalities(event);
	}

	function sAbnormalityFail(event) {
		return ModifyAbnormalities(event);
	}

	function sAbnormalityEnd(event) {
		return ModifyAbnormalities(event, true);
	}

	function sActionStage(event) {
		return ActionHCheck(event);
	}

	function sActionEnd(event) {
		return ActionHCheck(event, true);
	}

	function sInstanceArrow(event) {
		if (ProjDebug) {
			if (EqGid(event.gameId)) log('Projectile-Arrow', 'Spawned', 'from', MyName, event.skill.id);
			if (SUsers[event.gameId]) log('Projectile-Arrow', 'Spawned', 'from', SUsers[event.gameId].name, event.skill.id);
		}
		return ProjectileBCheck(event);
	}

	function sSpawnProjectile(event) {
		if (ProjDebug) {
			if (EqGid(event.gameId)) log('Projectile', 'Spawned', 'from', MyName, event.skill.id);
			if (SUsers[event.gameId]) log('Projectile', 'Spawned', 'from', SUsers[event.gameId].name, event.skill.id);
		}
		return ProjectileBCheck(event);
	}

	function sStartUserProjectile(event) {
		if (ProjDebug) {
			if (EqGid(event.gameId)) log('Projectile', 'Started', 'from', MyName, event.skill.id);
			if (SUsers[event.gameId]) log('Projectile', 'Started', 'from', SUsers[event.gameId].name, event.skill.id);
		}
		return ProjectileBCheck(event);
	}

	/*function sChangeDestposProjectile(event) {
		return ProjectileBCheck(event);
	}*/

	function sEndUserProjectile(event) {
		BProjectiles.delete(event.id);
	}

	function sDespawnProjectile(event) {
		BProjectiles.delete(event.id);
	}

	function sPlayerChangeMp(event) {
		if (!Cfg.HideMpNumbers || !EqGid(event.target)) return;
		if (event.type !== 0) {
			event.type = 0;
			return true;
		}
	}

	function sCreatureChangeHp(event) {
		if (!Cfg.HideHpNumbers || !EqGid(event.target)) return;
		if (event.type !== 10) {
			event.type = 10;
			return true;
		}
	}

	function sEachSkillResult(event) {
		return ModifySkillResult(event);
	}

	function sItemExplosionResult(event) {
		if (Cfg.Mode >= 2 || (EqGid(event.gameId) && Cfg.Hit_Me) || (!EqGid(event.gameId) && Cfg.Hit_Other) || Cfg.Hit_All || HUsers[event.gameId]) {
			for (const gameId of event.items) {
				if (SUsers[event.gameId] && Cfg.HideBlacklistedDrop && Cfg.DropBlacklist.some(item => MoteIds.indexOf(item) !== -1)) continue;
				mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId });
			}
			return false;
		}
	}

	function sSpawnDropItem(event) {
		if (EqGid(event.source)) return;
		if (Cfg.HideBlacklistedDrop && Cfg.DropBlacklist.indexOf(event.item) !== -1) return false;
		if (Cfg.Mode >= 2) {
			event.explode = 0;
			return true;
		}
	}

	function sFontSwapInfo() {
		if (Cfg.Hit_Damage || Cfg.Hit_All) return false;
	}

	function sSpawnEventSeed(event) {
		if (HUsers[event.owner] || Cfg.Mode >= 2) {
			HSeedBoxes.add(event.gameId);
			return false;
		}
	}

	function sUpdateEventSeedState(event) {
		if (HSeedBoxes.has(event.gameId)) return false;
	}

	function sResultEventSeed(event) {
		if (HSeedBoxes.has(event.gameId)) return false;
	}

	function sDespawnEventSeed(event) {
		HSeedBoxes.delete(event.gameId);
	}

	function sFieldEventOnEnter() {
		if (Cfg.GuardianAutoChange) {
			if ((LastGState !== null && Cfg.Mode === 2) || Cfg.Mode >= 2) return;
			LastGState = Cfg.Mode;
			Cmd.exec("fps state 2");
		}
	}

	function sFieldEventOnLeave() {
		if (Cfg.GuardianAutoChange) {
			if (LastGState === null || Cfg.Mode !== 2) {
				LastGState = null;
				return;
			}
			Cmd.exec(`fps state ${LastGState}`);
			LastGState = null;
		}
	}

	// ~~~ * Packet Hooks * ~~~ \\

	mod.hook('S_LOGIN', mod.majorPatchVersion < 114 ? 14 : 15, sLogin)
	mod.hook('S_LOAD_TOPO', 'raw', sLoadTopo)
	mod.hook('S_MOUNT_VEHICLE', 2, LastHook, sMountVehicle)
	mod.hook('S_UNMOUNT_VEHICLE', 2, LastHook, sUnmountVehicle)
	mod.hook('C_SET_VISIBLE_RANGE', 1, cSetVisibleRange)
	mod.hook('S_START_COOLTIME_ITEM', 1, LastHook, sStartCooltimeItem)
	mod.hook('S_START_ACTION_SCRIPT', 3, LastHook, sStartActionScript)

	mod.hook('S_LOADING_SCREEN_CONTROL_INFO', 'raw', LastHook, sLoadingScreenControlInfo)
	mod.hook('S_UPDATE_ACHIEVEMENT_PROGRESS', 1, LastHookfn, sUpdateAchievementProgress)
	mod.hook('S_ITEM_CUSTOM_STRING', 2, LastHook, sItemCustomString)

	mod.hook('S_SOCIAL', 1, LastHook, sSocial)
	mod.hook('S_GUILD_NAME', 2, LastHook, sGuildName)
	mod.hook('S_APPLY_TITLE', 3, LastHook, sApplyTitle)
	mod.hook('S_IMAGE_DATA', 'raw', LastHook, sImageData)

	mod.hook('S_SPAWN_USER', 15, LastHook, sSpawnUser)
	mod.hook('S_SPAWN_USER', 15, LastHookfn, sSpawnUserfn)
	mod.hook('S_DESPAWN_USER', 3, sDespawnUser)
	mod.hook('S_USER_LOCATION', 5, LastHook, sUserLocation)
	mod.hook('S_USER_STATUS', 3, LastHook, sUserStatus)
	mod.hook('S_DEAD_LOCATION', 2, sDeadLocation)
	mod.hook('S_USER_MOVETYPE', 1, LastHook, sUserMovetype)
	mod.hook('S_USER_APPEARANCE_CHANGE', 1, LastHook, sUserAppearanceChange)
	mod.hook('S_USER_CHANGE_FACE_CUSTOM', 2, LastHook, sUserChangeFaceCustom)
	mod.hook('S_USER_EXTERNAL_CHANGE', 7, LastHook, sUserExternalChange)
	mod.hook('S_UNICAST_TRANSFORM_DATA', 6, LastHook, sUnicastTransformData)

	mod.hook('S_PARTY_MEMBER_LIST', 7, sPartyMemberList)
	mod.hook('S_LEAVE_PARTY_MEMBER', 2, sLeavePartyMember)
	mod.hook('S_LEAVE_PARTY', 'raw', sLeaveParty)

	mod.hook('S_SPAWN_NPC', 11, LastHook, sSpawnNpc)
	mod.hook('S_DESPAWN_NPC', 3, LastHook, sDespawnNpc)
	mod.hook('S_NPC_LOCATION', 3, LastHook, sNpcLocation)
	mod.hook('S_CREATURE_LIFE', 3, sCreatureLife)
	mod.hook('S_CREATURE_ROTATE', 2, LastHook, sCreatureRotate)
	mod.hook('S_FEARMOVE_STAGE', 2, LastHook, sFearMoveStage)
	mod.hook('S_FEARMOVE_END', 2, LastHook, sFearMoveEnd)

	mod.hook('S_REQUEST_SPAWN_SERVANT', 4, LastHook, sRequestSpawnServant)
	mod.hook('S_REQUEST_DESPAWN_SERVANT', 1, sRequestDespawnServant)
	mod.hook('S_QUEST_BALLOON', 1, LastHook, sQuestBalloon)

	mod.hook('S_ABNORMALITY_BEGIN', 3, LastHookfn, sAbnormalityBegin)
	mod.hook('S_ABNORMALITY_REFRESH', 2, LastHookfn, sAbnormalityRefresh)
	mod.hook('S_ABNORMALITY_RESIST', 1, LastHookfn, sAbnormalityResist)
	mod.hook('S_ABNORMALITY_DAMAGE_ABSORB', 1, LastHookfn, sAbnormalityDamageAbsorb)
	mod.hook('S_ABNORMALITY_FAIL', 2, LastHookfn, sAbnormalityFail)
	mod.hook('S_ABNORMALITY_END', 1, LastHookfn, sAbnormalityEnd)

	mod.hook('S_ACTION_STAGE', 9, LastHook, sActionStage)
	mod.hook('S_ACTION_END', 5, LastHook, sActionEnd)
	mod.hook('S_INSTANCE_ARROW', 4, LastHook, sInstanceArrow)
	mod.hook('S_SPAWN_PROJECTILE', 5, LastHook, sSpawnProjectile)
	mod.hook('S_START_USER_PROJECTILE', 9, LastHook, sStartUserProjectile)
	//mod.hook('S_CHANGE_DESTPOS_PROJECTILE', 1, LastHook, sChangeDestposProjectile) //! Awaiting public def !\\
	mod.hook('S_END_USER_PROJECTILE', 4, sEndUserProjectile)
	mod.hook('S_DESPAWN_PROJECTILE', 2, sDespawnProjectile)

	mod.hook('S_PLAYER_CHANGE_MP', 1, LastHook, sPlayerChangeMp)
	mod.hook('S_CREATURE_CHANGE_HP', 6, LastHook, sCreatureChangeHp)
	mod.hook('S_EACH_SKILL_RESULT', 14, LastHook, sEachSkillResult)
	mod.hook('S_ITEM_EXPLOSION_RESULT', 2, LastHook, sItemExplosionResult)
	mod.hook('S_SPAWN_DROPITEM', 8, LastHook, sSpawnDropItem)
	mod.hook('S_FONT_SWAP_INFO', 'raw', LastHookfn, sFontSwapInfo)

	mod.hook('S_SPAWN_EVENT_SEED', 2, LastHook, sSpawnEventSeed)
	mod.hook('S_UPDATE_EVENT_SEED_STATE', 4, LastHook, sUpdateEventSeedState)
	mod.hook('S_RESULT_EVENT_SEED', 2, LastHook, sResultEventSeed)
	mod.hook('S_DESPAWN_EVENT_SEED', 1, sDespawnEventSeed)

	mod.hook('S_FIELD_EVENT_ON_ENTER', 'raw', sFieldEventOnEnter)
	mod.hook('S_FIELD_EVENT_ON_LEAVE', 'raw', sFieldEventOnLeave)

	// ~~~ * Commands * ~~~ \\

	Cmd.add('0', () => Cmd.exec('fps mode 0'));
	Cmd.add('1', () => Cmd.exec('fps mode 1'));
	Cmd.add('2', () => Cmd.exec('fps mode 2'));
	Cmd.add('3', () => Cmd.exec('fps mode 3'));

	Cmd.add(['fps', '!fps', 'fps-utils', '!fps-utils'], (key, arg, arg2, arg3) => {
		key = key ? key.toLowerCase() : key;
		arg = arg ? arg.toLowerCase() : arg;
		arg2 = arg2 ? arg2.toLowerCase() : arg2;
		arg3 = arg3 ? arg3.toLowerCase() : arg3;
		switch (key) {
			case "b": Cmd.exec('fps skills blacklist'); break;
			case "p": Cmd.exec('fps party'); break;
			case "g": case "gui": GuiHandler(arg, arg2); break;
			case "0": Cmd.exec('fps mode 0'); break;
			case "1": Cmd.exec('fps mode 1'); break;
			case "2": Cmd.exec('fps mode 2'); break;
			case "3": Cmd.exec('fps mode 3'); break;
			case "m": case "mod": case "mode": case "state":
				switch (arg) {
					case "0": case "off": case "zero":
						if (Cfg.Mode === 3) ShowAllPlayers();
						Cfg.Mode = 0;
						Cfg.HideAllAbnormalities = false;
						Cfg.HideAllProjectiles = false;
						if (!Cfg.Hit_All) Cfg.Hit_Other = false;
						Msg(`<font color="${RedC}">Modo 0</font>.`);
						break;
					case "1": case "one":
						if (Cfg.Mode === 3) ShowAllPlayers();
						Cfg.Mode = 1;
						Cfg.HideAllAbnormalities = false;
						Cfg.HideAllProjectiles = true;
						if (!Cfg.Hit_All) Cfg.Hit_Other = true;
						Msg(`<font color="${BnzC}">Modo 1</font>.`);
						break;
					case "2": case "two":
						if (Cfg.Mode === 3) ShowAllPlayers();
						Cfg.Mode = 2;
						Cfg.HideAllAbnormalities = true;
						Cfg.HideAllProjectiles = true;
						if (!Cfg.Hit_All) Cfg.Hit_Other = true;
						Msg(`<font color="${SlvC}">Modo 2</font>.`);
						break;
					case "3": case "three":
						HideAllPlayers();
						Cfg.Mode = 3;
						Cfg.HideAllAbnormalities = true;
						Cfg.HideAllProjectiles = true;
						if (!Cfg.Hit_All) Cfg.Hit_Other = true;
						Cfg.OnlyParty = false;
						Msg(`<font color="${GldC}">Modo 3</font>.`);
						break;
					default:
						Msg(`<font color="${GryC}">Argumento no válido: '${arg}'</font>.`);
						Msg(`Modos: "<font color="${PnkC}">[0, 1, 2, 3]</font>.`);
						break;
				}
				break;
			case "hide":
				if (typeof arg === "string" && arg !== null) {
					if (Cfg.PlayersBlacklist.includes(arg)) return Msg(`Jugador '${arg}' <font color="${RedC}">Ya escondido</font>.`);
					else
						if ((PClasses.includes(arg) && !Cfg.ClassesBlacklist.includes(arg)) || (PRoles.includes(arg) && !Cfg.RolesBlacklist.includes(arg))) {
							for (const cData in Cfg.ClassesData) {
								if ((Cfg.ClassesData[cData].name === arg || Cfg.ClassesData[cData].role.includes(arg)) && !Cfg.ClassesData[cData].isHidden) {
									Cfg.ClassesData[cData].isHidden = true;
									if (Cfg.ClassesData[cData].name === arg) Cfg.ClassesBlacklist.push(arg);
									if (Cfg.ClassesData[cData].role.includes(arg)) Cfg.RolesBlacklist.push(arg);
									let classtohide = Cfg.ClassesData[cData].model;
									for (const sUser in SUsers)
										if (ClassID(SUsers[sUser].templateId) === classtohide) HideSpecificPlayerByName(SUsers[sUser].name);
								}
							}
							Msg(`Clase/Rol ${arg} <font color="${GrnC}">Oculto</font>.`);
							return;
						} else if (Cfg.ClassesBlacklist.includes(arg) || Cfg.RolesBlacklist.includes(arg)) return Msg(`Clase/Rol '${arg}' <font color="${RedC}">Ya escondido</font>.`);
					Msg(`Jugador '${arg}' <font color="${GrnC}">Oculto</font>.`);
					Cfg.PlayersBlacklist.push(arg);
					HideSpecificPlayerByName(arg);
				} else Msg(`<font color="${GryC}">Argumento no válido: '${arg2}'</font>.`);
				break;
			case "show":
				if (typeof arg === "string" && arg !== null) {
					if (Cfg.PlayersBlacklist.includes(arg)) {
						ShowSpecificPlayerByName(arg);
						RemoveEntity(Cfg.PlayersBlacklist, arg);
						Msg(`Jugador '${arg}' <font color="${RedC}">Mostrado</font>.`);
						return;
					}
					if ((PClasses.includes(arg) && Cfg.ClassesBlacklist.includes(arg)) || (Cfg.RolesBlacklist.includes(arg) && PRoles.includes(arg))) {
						for (const cData in Cfg.ClassesData) {
							if (Cfg.ClassesData[cData].name === arg || Cfg.ClassesData[cData].role.includes(arg)) {
								if (Cfg.ClassesData[cData].name === arg) RemoveEntity(Cfg.ClassesBlacklist, arg);
								if (Cfg.ClassesData[cData].role.includes(arg)) RemoveEntity(Cfg.RolesBlacklist, arg);
								Cfg.ClassesData[cData].isHidden = false;
								let classToShow = Cfg.ClassesData[cData].model;
								for (const hUser in HUsers) if (ClassID(HUsers[hUser].templateId) === classToShow) ShowSpecificPlayerByName(HUsers[hUser].name);
							}
						}
						Msg(`Clase '${arg}' <font color="${RedC}">Mostrado</font>.`);
					} else if (!Cfg.ClassesBlacklist.includes(arg) || !Cfg.RolesBlacklist.includes(arg)) Msg(`Clase/Rol '${arg}' <font color="${RedC}">Ya mostrado</font>.`);
					else if (!Cfg.PlayersBlacklist.includes(arg)) Msg(`Jugador '${arg}' <font color="${RedC}">Ya mostrado</font>.`);
					else Msg(`<font color="${GryC}">Argumento no válido: '${arg2}'</font>.`);
				}
				break;
			case "party":
				if (Cfg.Mode === 3) return Msg(`<font color="${RedC}">Tienes que deshabilitar el modo 3 primero</font>.`);
				//if(!PMembers.size) return Msg(`<font color="${GryC}">You must be in party in-order to enable this</font>.`);
				Cfg.OnlyParty = !Cfg.OnlyParty;
				if (Cfg.OnlyParty) {
					for (const sUser in SUsers) {
						if (!PMembers.has(SUsers[sUser].name)) HideSpecificPlayerByName(SUsers[sUser].name);
						else if (HUsers[SUsers[sUser].gameId]) ShowSpecificPlayerByName(SUsers[sUser].name);
					}
				} else ShowAllPlayers();
				Msg(`Todos menos la party ${Cfg.OnlyParty ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "raid":
				Cfg.RaidAutoChange = !Cfg.RaidAutoChange;
				Msg(`Raid auto-estado ${Cfg.RaidAutoChange ? `<font color="${GrnC}">Activado</font>` : `<font color="${RedC}">Desactivado</font>`}.`);
				if (!Cfg.GuardianAutoChange) LastFState = null;
				break;
			case "guardian":
				Cfg.GuardianAutoChange = !Cfg.GuardianAutoChange;
				Msg(`Guardian auto-estado ${Cfg.GuardianAutoChange ? `<font color="${GrnC}">Activado</font>` : `<font color="${RedC}">Desactivado</font>`}.`);
				if (!Cfg.GuardianAutoChange) LastGState = null;
				break;
			case "pvptraps":
				Cfg.PvpTraps = !Cfg.PvpTraps;
				Msg(`Pvp Las trampas son ${Cfg.PvpTraps ? `<font color="${GrnC}">Mostrados<font color="${PnkC}">(No se ve afectado por ocultar todos los proyectiles)</font></font>` : `<font color="${RedC}">Normal<font color="${PnkC}">(Afectado por ocultar todos los proyectiles)</font></font>`}.`);
				break;
			case "list":
				Msg(`<font color="${PnkC}">Jugadores Ocultos: ${Cfg.PlayersBlacklist.length ? Cfg.PlayersBlacklist.join(', ') : 0}</font>.`);
				Msg(`<font color="${PnkC}">Clases Ocultas: ${Cfg.ClassesBlacklist.length ? Cfg.ClassesBlacklist.join(', ') : 0}</font>.`);
				Msg(`<font color="${PnkC}">Roles Ocultos: ${Cfg.RolesBlacklist.length ? Cfg.RolesBlacklist.join(', ') : 0}</font>.`);
				break;
			case "summons": case "sums":
				switch (arg) {
					case "me": case "own":
						Cfg.HideMySummons = !Cfg.HideMySummons;
						Cfg.HideMySummons ? HideNpcs('own') : ShowNpcs('own');
						Msg(`Los propios NPC convocados son ${Cfg.HideMySummons ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					default:
						Cfg.HideOthersSummons = !Cfg.HideOthersSummons;
						Cfg.HideOthersSummons ? HideNpcs('others') : ShowNpcs('others');
						Msg(`Otros NPC convocadas son ${Cfg.HideOthersSummons ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
				}
				break;
			case "skills": case "skill":
				switch (arg) {
					case "blacklist":
						Cfg.HideBlacklistedSkills = !Cfg.HideBlacklistedSkills;
						Msg(`Habilidades en la lista negra ${Cfg.HideBlacklistedSkills ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					case "class":
						if (PClasses.includes(arg2)) {
							for (const cData in Cfg.ClassesData) {
								if (Cfg.ClassesData[cData].name === arg2) {
									if (arg3 && !isNaN(arg3) && arg3 < 50) {
										if (Cfg.ClassesData[cData].CD_SkillsBlacklist.includes(arg3)) {
											let index = Cfg.ClassesData[cData].CD_SkillsBlacklist.indexOf(arg3);
											if (index !== -1) {
												Cfg.ClassesData[cData].CD_SkillsBlacklist.splice(index, 1);
												Msg(`ID de habilidad '${arg3}' <font color="${RedC}">Mostrado</font> para clase '${arg2}'.`);
											}
											return;
										} else {
											Cfg.ClassesData[cData].CD_SkillsBlacklist.push(arg3);
											Msg(`ID de habilidad '${arg3}' <font color="${GrnC}">Oculto</font> para clase '${arg2}'.`);
											return;
										}
									} else {
										Cfg.ClassesData[cData].CD_HideBlacklistedSkills = !Cfg.ClassesData[cData].CD_HideBlacklistedSkills;
										Msg(`Habilidades para '${arg2}' clase ${Cfg.ClassesData[cData].CD_HideBlacklistedSkills ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
										return;
									}
								}
							}
						} else Msg(`<font color="${RedC}">Clase ${arg2} extraviado</font>.`);
						break;
				}
				break;
			case "npcs": case "npc":
				if (arg === 'hide') {
					if (!arg2 || !arg3) {
						Cfg.HideBlacklistedNpcs = !Cfg.HideBlacklistedNpcs;
						Msg(`NPCs en la lista negra ${Cfg.HideBlacklistedNpcs ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					}
					const found = Cfg.NpcsBlacklist.some(s => s.zone === arg2 && s.templateId === arg3);
					if (found) {
						if (Cfg.HideBlacklistedNpcs) ShowSpecificNpcByHzTi(Number(arg2), Number(arg3));
						Msg(`NPC HntZone '${arg2}', TmpId '${arg3}' <font color="${RedC}">Eliminado de la lista negra</font>.`);
						Cfg.NpcsBlacklist = Cfg.NpcsBlacklist.filter(obj => obj.zone !== arg2 || obj.templateId !== arg3);
					} else {
						if (Cfg.HideBlacklistedNpcs) HideSpecificNpcByHzTi(Number(arg2), Number(arg3));
						Msg(`NPC HntZone '${arg2}', TmpId '${arg3}' <font color="${GrnC}">Añadido a la lista negra</font>.`);
						Cfg.NpcsBlacklist.push({ zone: arg2, templateId: arg3 });
					}
					return;
				} else {
					Cfg.HideBlacklistedNpcs = !Cfg.HideBlacklistedNpcs;
					Cfg.HideBlacklistedNpcs ? HideNpcs('bl') : ShowNpcs('bl');
					Msg(`NPCs en la lista negra ${Cfg.HideBlacklistedNpcs ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				}
				break;
			case "hit":
				switch (arg) {
					case "me":
						if (Cfg.Hit_All) return Msg(`<font color="${RedC}">Tienes que deshabilitar Hit ALL primero</font>.`);
						Cfg.Hit_Me = !Cfg.Hit_Me;
						Msg(`Efecto de Hit propios ${Cfg.Hit_Me ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					case "other":
						if (Cfg.Hit_All) return Msg(`<font color="${RedC}">Tienes que deshabilitar Hit ALL primero</font>.`);
						Cfg.Hit_Other = !Cfg.Hit_Other;
						Msg(`Efecto de Hit de los jugadores ${Cfg.Hit_Other ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					case "damage":
						if (Cfg.Hit_All) return Msg(`<font color="${RedC}">Tienes que deshabilitar Hit ALL primero</font>.`);
						Cfg.Hit_Damage = !Cfg.Hit_Damage;
						Msg(`Números de daños ${Cfg.Hit_Damage ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					case "all":
						Cfg.Hit_Me = Cfg.Hit_Other = Cfg.Hit_Damage = false;
						Cfg.Hit_All = !Cfg.Hit_All;
						Msg(`Hit all ${Cfg.Hit_All ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					default:
						Msg(`<font color="${GryC}">Argumento de hit no válido: '${arg}'</font>.`);
						break;
				}
				break;
			case "fireworks": case "firework":
				Cfg.HideFireworks = !Cfg.HideFireworks;
				Msg(`Fuegos artificiales ${Cfg.HideFireworks ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "abn": case "effects": case "abnormal": case "abnormalities":
				switch (arg) {
					case "all":
						Cfg.HideAllAbnormalities = !Cfg.HideAllAbnormalities;
						Msg(`Todas las anomalías ${Cfg.HideAllAbnormalities ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					case "blacklist":
						if (!arg2 || !arg3) {
							Cfg.HideBlacklistedAbnormalities = !Cfg.HideBlacklistedAbnormalities;
							Msg(`Anomalías en la lista negra ${Cfg.HideBlacklistedAbnormalities ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
							break;
						} else if (arg2 && arg3) {
							arg3 = Number(arg3);
							if (!Cfg.AbnormalitiesBlacklist.includes(arg3)) {
								if (arg2 === 'add') {
									Cfg.AbnormalitiesBlacklist.push(arg3);
									Msg(`Anomalías en la lista negra <font color="${GrnC}">agregada '${arg3}'</font>.`);
									return;
								} else if (arg2 === 'remv') return Msg(`Anomalías en la lista negra <font color="${RedC}">no se puede eliminar '${arg3}' porque no está allí</font>.`);

							} else if (Cfg.AbnormalitiesBlacklist.includes(arg3)) {
								if (arg2 === 'add') return Msg(`Anomalías en la lista negra <font color="${RedC}">no se puede agregar '${arg3}' porque ya está allí</font>.`);
								else if (arg2 === 'remv') {
									let index = Cfg.AbnormalitiesBlacklist.indexOf(arg3);
									if (index !== -1) {
										Cfg.AbnormalitiesBlacklist.splice(index, 1);
										Msg(`Anomalías en la lista negra <font color="${RedC}">eliminado '${arg3}'</font>.`);
										return;
									}
								}
							} else return Msg(`<font color="${GryC}">Argumento de la lista negra de anomalías no válidas: '${arg}'</font>.`);
						}
						break;
					case "log":
					case "debug":
						AbnDebug = !AbnDebug;
						if (AbnDebug) Msg(`Depuración de anomalías <font color="${GrnC}">iniciado</font>, consulta la consola de tu proxy para obtener más detalles.`)
						else Msg(`Depuración de anomalías <font color="${RedC}">detenido</font>.`);
						break;
					default:
						Msg(`<font color="${GryC}">Argumento de anomalías no válido: '${arg}'</font>.`);
						break;
				}
				break;
			case "guildlogo":
				if (SwitchCd) return Msg(`<font color="${PnkC}">Vuelve a intentarlo en 3 segundos</font>.`);
				Cfg.Hideguildlogos = !Cfg.Hideguildlogos;
				mod.toServer('C_SET_VISIBLE_RANGE', 1, { range: 0 });
				mod.setTimeout(() => mod.toServer('C_SET_VISIBLE_RANGE', 1, { range: LastVrange }), 15E2);
				SwitchCd = true;
				mod.setTimeout(() => SwitchCd = false, 28E2);
				Msg(`Logotipos de Guild ${Cfg.Hideguildlogos ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "costume": case "style":
				if (SwitchCd) return Msg(`<font color="${PnkC}">Vuelve a intentarlo en 3 segundos</font>.`);
				Cfg.ShowStyle = !Cfg.ShowStyle;
				mod.toServer('C_SET_VISIBLE_RANGE', 1, { range: 0 });
				mod.setTimeout(() => mod.toServer('C_SET_VISIBLE_RANGE', 1, { range: LastVrange }), 15E2);
				SwitchCd = true;
				mod.setTimeout(() => SwitchCd = false, 28E2);
				Msg(`Estilo de NPCs y otros ${Cfg.ShowStyle ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "proj": case "projectile":
				switch (arg) {
					case "all":
						Cfg.HideAllProjectiles = !Cfg.HideAllProjectiles;
						Msg(`Proyectiles ${Cfg.HideAllProjectiles ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					case "blacklist":
						if (!arg2 || !arg3) {
							Cfg.HideBlacklistedProjectiles = !Cfg.HideBlacklistedProjectiles;
							Msg(`Proyectil en la lista negra ${Cfg.HideBlacklistedProjectiles ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
							break;
						} else if (arg2 && arg3) {
							arg3 = Number(arg3);
							if (!Cfg.ProjectilesBlacklist.includes(arg3)) {
								if (arg2 === 'add') {
									Cfg.ProjectilesBlacklist.push(arg3);
									Msg(`Proyectil en la lista negra <font color="${GrnC}">added '${arg3}'</font>.`);
									return;
								} else if (arg2 === 'remv') return Msg(`Proyectil en la lista negra <font color="${RedC}">no se puede eliminar '${arg3}' porque no está allí</font>.`);
							} else if (Cfg.ProjectilesBlacklist.includes(arg3)) {
								if (arg2 === 'add') return Msg(`Proyectil en la lista negra <font color="${RedC}">no se puede agregar '${arg3}' porque ya está allí</font>.`);
								else if (arg2 === 'remv') {
									let index = Cfg.ProjectilesBlacklist.indexOf(arg3);
									if (index !== -1) {
										Cfg.ProjectilesBlacklist.splice(index, 1);
										Msg(`Proyectil en la lista negra <font color="${RedC}">eliminado '${arg3}'</font>.`);
										return;
									}
								}
							} else return Msg(`<font color="${GryC}">Argumento de lista negra de proyectil no válido: '${arg}'</font>.`);
						}
						break;
					case "log": case "debug":
						ProjDebug = !ProjDebug;
						if (ProjDebug) Msg(`Depuración de proyectiles <font color="${GrnC}">iniciado</font>, consulta la consola de tu proxy para obtener más detalles.`);
						else Msg(`Depuración de proyectiles <font color="${RedC}">detenido</font>.`);
						break;
					default:
						Msg(`<font color="${GryC}">Argumento de proyectil no válido: '${arg}'</font>.`);
						break;
				}
				break;
			case "quicklink":
				switch (arg) {
					case "mail": case "parcel":
						mod.toServer('C_REQUEST_CONTRACT', 1, { type: 8 });
						break;
					case "talent": case "talents":
						mod.toServer('C_REQUEST_CONTRACT', 1, { type: 78 });
						break;
					case "broker":
						mod.toClient('S_NPC_MENU_SELECT', 1, { type: 28 });
						break;
					case "dress": case "dressingroom":
						mod.toServer('C_REQUEST_CONTRACT', 1, { type: 77 });
						break;
					case "hat": case "hatrestyle":
						mod.toServer('C_REQUEST_CONTRACT', 1, { type: 91 });
						break;
					case "lobby":
						mod.toServer('C_RETURN_TO_LOBBY', 1);
						break;
					case "exit": case "instantexit":
						mod.toClient('S_EXIT', 3, { category: 0, code: 0 });
						break;
					case "drop":
						mod.toServer('C_LEAVE_PARTY', 1);
						break;
					case "disband":
						mod.toServer('C_DISMISS_PARTY', 1);
						break;
					case "reset":
						mod.toServer('C_RESET_ALL_DUNGEON', 1);
						break;
					default:
						Msg(`<font color="${GryC}">Enlace rápido no válido '${arg}'</font>.`);
						break;
				}
				break;
			case "npczoom":
				Cfg.ActionScripts = !Cfg.ActionScripts;
				Msg(`Npc zoom-ins ${Cfg.ActionScripts ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "dropitem": case "drops":
				if (arg === 'hide') {
					if (!arg2) {
						Cfg.HideBlacklistedDrop = !Cfg.HideBlacklistedDrop;
						Msg(`Drops en la lista negra ${Cfg.HideBlacklistedDrop ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					}
					arg2 = Number(arg2);
					const found1 = Cfg.DropBlacklist.some(s => s === arg2);
					if (found1) {
						Msg(`Drops id '${arg2}' <font color="${RedC}">Eliminado de la lista negra</font>.`);
						Cfg.DropBlacklist = Cfg.DropBlacklist.filter(obj => obj !== Number(arg2));
					} else {
						Msg(`Drops id '${arg2}' <font color="${GrnC}">Añadido a la lista negra</font>.`);
						Cfg.DropBlacklist.push(arg2);
					}
					return;
				} else Cfg.HideBlacklistedDrop = !Cfg.HideBlacklistedDrop;
				Msg(`Drops en la lista negra ${Cfg.HideBlacklistedDrop ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "monsterdeathani": case "monstersdeathani":
				Cfg.HideMonsterDeathAnimation = !Cfg.HideMonsterDeathAnimation;
				Msg(`Animación de la Muerte de los Monstruos es ${Cfg.HideMonsterDeathAnimation ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "screenabns": case "blur":
				if (arg === 'hide') {
					if (!arg2) {
						Cfg.HideOwnBlacklistedAbns = !Cfg.HideOwnBlacklistedAbns;
						Msg(`Anomalías de Pantalla en la lista negra ${Cfg.OwnAbnormalsBlacklist ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					}
					arg2 = Number(arg2);
					const found2 = Cfg.OwnAbnormalsBlacklist.some(m => m === arg2);
					if (found2) {
						Msg(`Abnormal id '${arg2}' <font color="${RedC}">Eliminado de la lista negra</font>.`);
						Cfg.OwnAbnormalsBlacklist = Cfg.OwnAbnormalsBlacklist.filter(obj => obj !== Number(arg2));
					} else {
						Msg(`Abnormal id '${arg2}' <font color="${GrnC}">Añadido a la lista negra</font>.`);
						Cfg.OwnAbnormalsBlacklist.push(arg2);
					}
					return;
				} else Cfg.HideOwnBlacklistedAbns = !Cfg.HideOwnBlacklistedAbns;
				Msg(`Anomalías de Pantalla en la lista negra ${Cfg.HideOwnBlacklistedAbns ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "pet": case "pets": case "servant": case "servants":
				switch (arg) {
					case "me":
						Cfg.HideMyServants = !Cfg.HideMyServants;
						Cfg.HideMyServants ? HideNpcs('pet', 'own') : ShowNpcs('pet', 'own');
						Msg(`Las Mascotas propias son ${Cfg.HideMyServants ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
					default:
						Cfg.HideOthersServants = !Cfg.HideOthersServants;
						Cfg.HideOthersServants ? HideNpcs('pet', 'others') : ShowNpcs('pet', 'others');
						Msg(`Otras Mascotas convocadas son ${Cfg.HideOthersServants ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
						break;
				}
				break;
			case "hpnumbers":
				Cfg.HideHpNumbers = !Cfg.HideHpNumbers;
				Msg(`Números propios de HP ${Cfg.HideHpNumbers ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "mpnumbers":
				Cfg.HideMpNumbers = !Cfg.HideMpNumbers;
				Msg(`Números propios de MP ${Cfg.HideMpNumbers ? `<font color="${GrnC}">Oculto</font>` : `<font color="${RedC}">Mostrado</font>`}.`);
				break;
			case "muteothers":
				Cfg.MuteOthersVoice = !Cfg.MuteOthersVoice;
				Msg(`Silenciar la voz de otros es ${Cfg.MuteOthersVoice ? `<font color="${GrnC}">Activado</font>` : `<font color="${RedC}">Desactivado</font>`}.`);
				break;
			case "petspopup":
				Cfg.HideServantBalloons = !Cfg.HideServantBalloons;
				Msg(`Ocultar Globos de Chat Emergentes de Mascotas es ${Cfg.HideServantBalloons ? `<font color="${GrnC}">Activado</font>` : `<font color="${RedC}">Desactivado</font>`}.`);
				break;
			case "stream":
				Cfg.StreamMode = !Cfg.StreamMode;
				Msg(`El modo Stream es ${Cfg.StreamMode ? `<font color="${GrnC}">Activado</font>` : `<font color="${RedC}">Desactivado</font>`}.`);
				if (Cfg.StreamMode) console.log("\x1b[94mINFO\x1b[34m [FPS-UTILS]\x1b[39m - El modo Steam se ha habilitado, no se enviarán mensajes en el juego hasta que se deshabilite.");
				else console.log("\x1b[94mINFO\x1b[34m [FPS-UTILS]\x1b[39m - El modo Steam ha sido deshabilitado.");
				break;
			case "help": case "h":
				Cmd.exec("fps gui help");
				break;
			default:
				//Msg(`<font color="${RedC}">Comando desconocido, verifique la lista de comandos</font>.`);
				//Cmd.exec("fps gui help");
				Cmd.exec("fps gui");
				break;
		}
		if (!NotCP && typeof Cfg.ClassesData["12"] === 'undefined') mod.saveSettings();
	})
}