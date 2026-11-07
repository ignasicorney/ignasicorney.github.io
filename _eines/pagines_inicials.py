import sys; sys.path.insert(0, '_eines')
from blocs import *

P = {}
P['index.html'] = pagina('Inici', "Espai personal d'Ignasi Corney Oller, amb una cronologia i resum de la seva trajectòria que recull articles, reportatges, entrevistes, revistes, llibres i pòdcast.", [
 carrussel('inici', 'portada', 'Imatges preses per un servidor'),
 text('''<p>D'esquerra a dreta, imatges preses per un servidor:</p>
<ul>
<li>La pedregada de 31.08.2022. Diversos mitjans i agències em van demanar fer ús dels vídeos i fotografies, i els vaig dir que endavant. El que no sabia era que aquelles imatges del meteor donarien la volta al món i arribarien a mitjans internacionals.</li>
<li>La nevada de 08.03.2010 ens va deixar sense fluid elèctric, sense telefonia, sense aigua i amb una estranya sensació de precarietat. Cada dia al vespre feia ronda de trucades amb els alcaldes per conèixer les novetats que hi havia en cada població.</li>
<li>Vista aèria de la Bisbal des d'un globus aerostàtic feta amb teleobjectiu el 27.08.2015.</li>
<li>Un autobús de la <i>Sarfa</i> va derrapar amb el ferm moll al c. Sis d'octubre de 1869 el 06.06.2006.</li>
</ul>''')])

P['salutacio/index.html'] = pagina('Salutació', "Presentació d'Ignasi Corney Oller, docent a l'INS la Bisbal, presentador de l'Aplec de la Sardana i moderador de debats a la Bisbal d'Empordà.", [
 text('''<h2>Benvinguts</h2>
<p>Procuro fer el que toca sense molestar o afectar ningú. A vegades, i sense mala fe, m'equivoco.</p>
<p>Estimo les Gavarres, els seus camins i els seus espais. A partir d'un curs que vaig fer, vaig generar un joc de <i>memory</i> amb les fitxes de les <a href="https://drive.google.com/file/d/1sYAlYHEc2KerXKpIPQgeLf4ZBLbnICu2/view">plantes</a> i dels <a href="https://drive.google.com/file/d/1nBmO3SDXaDB8umUt3SutQ3zdlEgU_83i/view">ocells</a> més representatius del massís. Cedeixo aquest material per si a algú li és útil.</p>
<p>Actualment treballo com a docent a l'INS la Bisbal, a casa, al meu poble. I m'encanta, em sembla un privilegi. Tot i això, he voltat durant 16 anys per instituts de la província: Banyoles, Castelló d'Empúries, L'Escala, Palafrugell, Girona, Celrà, Salt, Puigcerdà, Palafrugell, Figueres, Vilafant i Calonge i Sant Antoni.</p>
<p>Per altra part, fa més d'una vintena d'anys que presento l'Aplec de la sardana (diria que vaig començar l'any 2005):</p>'''),
 carrussel('aplec', 'diapos', 'Aplec de la Sardana'),
 text('''<p>En l'àmbit de la Comunicació, he fet tots els papers de l'auca excepte posar-me davant d'una càmera. Vaig escriure molt sobre la Bisbal i pobles veïns des de ben jove, i en trobareu informació a l'apartat <a href="/publicacions/"><i>Publicacions</i></a>. He fet també la moderació de dos debats a l'alcaldia de la Bisbal (14.05.2011 i 16.05.2015), de xerrades i conferències, i vaig presentar a Monells el llibre <i>La memòria de les formigues</i>, de Iolanda Batallé Prats.</p>'''),
 carrussel('debats', 'diapos', 'Debats i taules rodones')])

P['publicacions/index.html'] = pagina('Publicacions', "Resum dels articles periodístics, reportatges, entrevistes i revistes publicats per Ignasi Corney Oller.", [
 text('''<h2 id="articles">Articles</h2>
<p>Amb 17 anys em vaig presentar al I Concurs d'articles periodístics de les comarques gironines organitzat per la Secretaria General de Joventut. El professor de Llengua catalana, en Ramon Caralt Barris, ens motivava a presentar-nos a concursos. <i>Pels drets Humans amb majúscula</i> es va publicar el 27.11.1998 al diari <i>El Punt</i> quan jo ja tenia 18 anys i ja havia començat la facultat.</p>'''),
 imatges([{'f':'dc68d7a7806f408696d5349526ec1adc','ext':'jpg','alt':'Pels drets humans amb majúscula. El Punt, 27.11.1998','amplada':600}], 'centre'),
 text('''<p>Aquell article no va ser gaire planificat i, un cop el vaig haver lliurat, recordo que em vaig adonar d'un error que contenia i vaig pensar que em descartarien. La sensació interna era d'estar content perquè m'havia atrevit a presentar-me.</p>
<p>El premi va reforçar la convicció de seguir escrivint. La sang em bullia de ganes de fer coses i d'obrir-me a l'experiència comunicativa. Poc després coneixeria Carles Puigdemont Casamajó, un nom que llavors no em deia gaire res. Era un marrec de 18 o 19 anys que estudiava filologia i volia fer periodisme, i ell treballava de periodista. En Carles havia creat un gabinet de premsa per a associacions (Gabinet.net) i em vaig atrevir a escriure-li. Ens vam reunir per parlar i recordo haver-li comentat que una agència de notícies semblava tenir més sentit. Vam quedar que m'avisaria uns mesos més tard, perquè alguna cosa s'estava coent. I així ho va fer. El 1999 naixia l'actual ACN, llavors <i>Intra-ACN</i>. Com que en aquella època col·laborava amb Ràdio Bisbal, em va semblar interessant aportar informació a canvi de tenir accés a l'agència. I així ho vam fer, de manera que vaig ser el primer col·laborador extern no remunerat que van tenir.</p>
<p>L'agost de l'any 2000 vaig assumir la corresponsalia del <i>Diari de Girona</i> fins al setembre de 2007. Els articles havien d'anar signats per a ser cobrats, però els redactors canviaven els titulars, introduïen errades tipogràfiques o ortogràfiques i, sovint, el text de la notícia no s'adeia amb el titular. La batalla del dimensionament entre el fet noticiable i el titular que l'encapçalava, la vaig haver de lliurar tantes i tantes vegades, que me'n vaig cansar i vaig plegar.</p>
<p>La primera notícia que vaig escriure al <i>Diari de Girona</i> va ser sobre l'abastament d'aigua potable al nucli de Sant Pol i, durant anys, vaig fer seguiment de l'abocador de Vacamorta. En el breu període en què vaig treballar a <i>Ràdio Costa Brava</i> vaig ampliar la cobertura a l'àmbit comarcal per aprofitar el flux de treball.</p>
<p>A continuació he seleccionat una seixantena de les més d'un miler de notícies que vaig escriure durant aquell període:</p>'''),
 carrussel('diari_de_girona', 'diapos', 'Notícies al Diari de Girona, 2000-2007'),
 text('''<h2 id="reportatges">Reportatges i entrevistes</h2>
<p>Aquests són alguns reportatges i entrevistes que es van publicar a <i>Diari de Girona:</i></p>'''),
 carrussel('reportatges', 'tira', 'Reportatges i entrevistes al Diari de Girona'),
 text('''<p>A <i>totbisbal</i> vaig voler aplicar un format d'entrevista que tenia les mateixes preguntes per a les dues parts en litigi que vaig anomenar <i>Versus</i>. Recordo haver entrevistat el músic hippie, Pau Riba Romeva i, amb en Roger Font Vilagran, vam xalar de valent en haver rescatat de l'oblit col·lectiu que la Bisbal havia tingut un <a href="https://drive.google.com/file/d/1psF8uhaQxPkPQF3NjdEYuUDgEGFa6Wat/view">club d'handbol</a>.</p>
<p>També vaig fer un reportatge especial sobre la variant de la Bisbal per a <i>La Palanca</i>, la revista de Cruïlles.</p>
<p>A més, vaig fer algunes col·laboracions a <i>Revista de Girona</i> que enllaço a continuació:</p>
<p><a href="https://www.ddgi.cat/revistadegirona/recursos/2000/0204_095.pdf">La influència de l'Església a Catalunya</a> (ressenya de llibre, 2000),<br>
<a href="https://www.ddgi.cat/revistadegirona/recursos/2004/0224_011.pdf">Antoni Martí, el llegat social en imatges</a> (2004),<br>
<a href="https://www.ddgi.cat/revistadegirona/recursos/2007/0242_009.pdf">Les dunes, un exemple estoic de resistència</a> (2007),<br>
<a href="https://www.ddgi.cat/revistadegirona/recursos/2007/0243_010.pdf">La qualitat de vida del discapacitat psíquic</a> (2007), i<br>
<a href="https://www.ddgi.cat/revistadegirona/recursos/2008/0250_007.pdf">Un Trampolí per als discapacitats psíquics</a> (2008).</p>
<h2 id="revistes">Revistes</h2>
<p>Espero deixar pròximament aquí les revistes que vaig escriure, per descàrrega.</p>''')])

P['llibres/index.html'] = pagina('Llibres', "Llibertat truncada, el llibre d'Ignasi Corney Oller sobre la Guerra Civil a la Bisbal d'Empordà, i els projectes d'història local en curs.", [
 text('''<h2>Llibertat truncada</h2>
<p>És el meu primer llibre. Tracta la Guerra Civil a la Bisbal d'Empordà i és fruit de més de quatre anys de feina i ordena, corregeix, actualitza i connecta moltes fonts documentals. El primer volum, de 1930 a 1940, veia la llum al novembre de 2024. La investigació va obrir una col·laboració amb Jordi Oliva Llorens per actualitzar les dades de l'<a href="https://www.tdx.cat/handle/10803/690785"><i>Estudi del cost humà de la Guerra Civil a Catalunya</i></a>.</p>'''),
 imatges([{'f':'57243cf880e74f5e9ba2b57e5af8ce62','ext':'jpg','alt':'Coberta del llibre Llibertat truncada','amplada':277}], 'centre'),
 text('''<p>A banda del segon volum de <i>Llibertat truncada</i>, tinc dos llibres més iniciats (un en solitari i un en col·laboració) i un parell més de projectats. Tots ells estan relacionats amb la història local.</p>
<p>El següent audiovisual acompanya el llibre:</p>'''),
 video('N19krb1zOOg', "Imatges d'una Llibertat truncada")])

P['latdg/index.html'] = pagina('LaTdG', "De la revista El Drac i Ràdio Bisbal a totbisbal i La Torre de Guaita, el pòdcast d'informació local d'Ignasi Corney Oller.", [
 text('''<h2>La Torre de Guaita</h2>
<p>Els meus orígens en la Comunicació se situen en la revista <i>El Drac</i>, amb en Marià Sais Ribas, la Susanna Parals Expòsit, la M. Dolors Figueras Bruguera, en Jordi Frigola Arpa i altres persones que no recordo, i els amics que hi vam entrar plegats, l'Albert Barceló Boada i en Toni Hermoso Pulido. A <i>Ràdio Bisbal</i> ens va mancar algú amb experiència que pogués ensenyar-nos. Aquests dos mitjans locals eren els que hi havia i van ser la meva primera escola de formació, inspiració i creixement com a persona -en vindrien altres, amb el temps-, amb totes les experiències i errades que un, quan comença a fer alguna cosa amb 16 i 17 anys, i fins i tot més, comet.</p>
<p>M'agradava més parlar que guionitzar, i la ràdio tenia l'atractiu de les músiques i de les sintonies. A Ràdio Bisbal hi vaig passar ben bé nou anys. Després vaig estar poc temps a <i>Ràdio Costa Brava</i>, emissora mítica pertanyent llavors a la cadena <i>Ona Catalana</i>, on vaig fer de tècnic i de redactor d'informatius per a les redaccions de Girona i de Barcelona.</p>
<p>A <i>totbisbal</i> se'm va ocórrer crear una ràdio digital que emetia música per internet amb un ordinador que començava a emetre al matí i que s'apagava automàticament. Em feia por que un dia els meus pares me l'apaguessin per gastar massa corrent elèctrica. Un cop al mes, i durant força anys, vam estar experimentant la transmissió en directe dels plens municipals i, un cop a l'any, emetíem també l'Aplec de la sardana. A mode de pòdcast, penjàvem els àudios de conferències i actes que enteníem rellevants per a la població. A més, l'any 2014 vam emetre en directe i per aquest sistema una entrevista a Miquel Abras Salvà, que presentava el disc <i>Per amor a l'art</i> des de la llibreria <i>La Placeta</i>, que va regentar un temps la seva mare.</p>
<p>L'any 2017 vaig fer un pòdcast, <i>Cròniques des de l'exili</i>, que va comptar amb un parell d'edicions, atès que aquell any decidíem posar punt i final al projecte <i>totbisbal</i> després de 13 anys en funcionament.</p>
<p>Una de les persones que als estius m'ajudava feia alguns anys era en Roger Font Vilagran, que l'any 2022 decidia impulsar el mitjà digital que ens rellevaria: <a href="https://laguait.cat"><i>L'aguait</i></a>. Després de temps donant-hi voltes i de preparar-ho, com a mínim des de les acaballes de 2025, he decidit tornar als orígens i iniciar aquest 2026 <a href="https://laguait.cat/latdg"><i>La Torre de Guaita</i></a>, un pòdcast que és el meu retorn a la informació local. El nom té ressonància amb "aguaitar" i, és clar, una torre de guaita és un lloc de vigilància on hi ha algú que alerta d'allò que veu. La informació passa per un primer filtre però s'accepta tot i encara hi ha un cert component "en brut".</p>'''),
 imatges([{'f':'8c672aaa5054407dbd511067564d3d0c','ext':'jpg','alt':'Logotip de La Torre de Guaita','enllac':'https://laguait.cat/series/latdg/','amplada':267},
          {'f':'823c9b2184df4a81832c9334c3bea2b1','ext':'jpg','alt':'El portal de la riera','amplada':236}], 'centre', True)])

vids=[("w7gfiXKZRcI","Les tasques d'extinció de l'incendi de les Gavarres iniciat a Sant Pol, de 03.07.2026:"),("WYim6-fCyes","L'arribada de la flama del Canigó de 23.06.2026:"),("5Pg8GHZ4iAU","El testimoni de l'incendi de Canapost de 19.06.2026:"),("-Xz_2hfL2mQ","La rua de carnaval de 21.02.2026:"),("1g4n2JLg5OU","I la llevantada viscuda a la població el 20.01.2026:")]
b=[text('''<h2>El batec del territori</h2>
<p>L'any 2009 a <i>totbisbal</i> vam posar en funcionament un espai de televisió i vaig aprendre a filmar i a editar només observant els treballs d'en Xevi Codolà Vilahur, que va ser company de filmacions uns quants anys. També vaig participar en algun projecte audiovisual. Tot el material el tinc desat i espero poder-vos-el oferir pròximament per a visualització i descàrrega.</p>
<p>Encara segueixo filmant i editant. Exemples d'enguany en són:</p>''')]
for id,t in vids:
    b.append(text('<p>'+t+'</p>')); b.append(video(id, t.rstrip(':')))
P['videos/index.html'] = pagina('Vídeos', "El batec del territori. Vídeos filmats i editats per Ignasi Corney Oller a la Bisbal d'Empordà i les Gavarres.", b)

for k,v in P.items(): open(k,'w').write(v)
print('ok', len(P))
