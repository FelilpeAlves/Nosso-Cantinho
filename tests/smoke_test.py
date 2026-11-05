"""Teste de ponta a ponta do Nosso Cantinho. Execute com servidor na porta 8765."""
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:8765/'
with sync_playwright() as p:
 browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
 context = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, accept_downloads=True)
 page=context.new_page(); errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto(URL,wait_until='networkidle')
 assert page.title()=='Nosso Cantinho ♡'
 assert page.locator('#todayTasks .task-card').count()==4, 'amostras iniciais'
 assert page.locator('#fatalError').is_hidden(), 'sem falhas de inicialização'
 page.get_by_role('button',name='Tarefas', exact=True).last.click()
 assert page.locator('#page-tasks').is_visible()
 page.locator('#taskTitle').fill('Lavar janelas')
 page.locator('#taskCategory').select_option('sala')
 page.locator('#taskOwner').select_option('Aline')
 page.locator('#taskFrequency').select_option('weekly')
 page.locator('#saveTask').click()
 assert page.locator('#allTasks .task-card').count()==5, 'nova tarefa'
 assert page.get_by_text('Lavar janelas').count()>=1
 card=page.locator('#allTasks .task-card').filter(has_text='Lavar janelas')
 card.get_by_role('button',name='Editar').click()
 assert page.locator('#taskTitle').input_value()=='Lavar janelas'
 page.locator('#taskTitle').fill('Limpar as janelas')
 page.locator('#saveTask').click()
 assert page.locator('#allTasks .task-card').filter(has_text='Limpar as janelas').count()==1
 # conclusão e gratidão
 card=page.locator('#allTasks .task-card').filter(has_text='Limpar as janelas')
 card.get_by_role('button',name='Concluir').click()
 assert card.get_by_text('Concluída').count()==1
 card.get_by_role('button',name='Agradecer').click()
 assert page.locator('#thanksDialog').is_visible()
 page.get_by_role('button',name='Obrigado por cuidar da nossa casa! ❤️').click()
 page.locator('#thanksForm button[type=submit]').click()
 page.locator('[data-nav=us]').click()
 assert 'Obrigado por cuidar da nossa casa!' in page.locator('#messages').inner_text()
 assert '1' in page.locator('#stats').inner_text()
 # persistência ao recarregar
 page.reload(wait_until='networkidle')
 page.locator('[data-nav=tasks]').click()
 assert page.locator('#allTasks .task-card').count()==5
 assert page.locator('#allTasks .task-card').filter(has_text='Limpar as janelas').get_by_text('Concluída').count()==1
 # rotina
 page.locator('[data-nav=routine]').click()
 assert page.locator('#routineTasks .task-card').count()==5, 'todas amostras recorrentes'
 # backup
 page.locator('[data-nav=us]').click()
 with page.expect_download() as info: page.locator('#exportBtn').click()
 download=info.value
 assert download.suggested_filename.startswith('nosso-cantinho-backup-')
 # XSS guard
 page.locator('[data-nav=tasks]').click()
 page.locator('#taskTitle').fill('<img src=x onerror=alert(1)>')
 page.locator('#saveTask').click()
 assert page.locator('#allTasks').locator('img[src="x"]').count()==0
 # desktop
 page.set_viewport_size({'width':1280,'height':820})
 page.reload(wait_until='networkidle')
 assert page.locator('body').evaluate('(x)=>x.scrollWidth') <= 1280
 # mobile narrow
 page.set_viewport_size({'width':320,'height':720})
 page.reload(wait_until='networkidle')
 assert page.locator('body').evaluate('(x)=>x.scrollWidth') <= 320, 'sem scroll horizontal'
 page.screenshot(path='/mnt/data/nosso_cantinho_release/tests/preview-mobile.png',full_page=True)
 assert not errors, errors
 print('PASSOU: navegação, adicionar, editar, concluir, agradecer, localStorage, rotina, backup, XSS, 320px, desktop. Sem erros JS.')
 browser.close()
